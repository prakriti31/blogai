const express = require("express");
const axios = require('axios');
// Elastic search client
// const esClient = require("./elasticsearchClient");
const mongoose = require("mongoose");
const app = express();
const path = require("path");
const ejs = require("ejs");
const sessions = require("express-session");
// const collection = require("./mongodb");
const PosT = require("./postdb");
const Profile = require("./profiledb");
// At the top of app.js (after other require statements)
const { generateReply } = require("../openaihelper/openai");
// const conn = require("./connection")
let imagename
const multer = require("multer");
const { send, title } = require("process");
const { profile } = require("console");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/thumbnails");
  },
  filename: (req, file, cb) => {
    // console.log(file);

    cb(null, file.originalname);
    imagename = file.originalname;
  },
});
const upload = multer({ storage: storage });
let user;
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(
  sessions({
    secret: "secret key",
    saveUninitialized: true,
    resave: false,
  })
);

const visitSchema = new mongoose.Schema({
  visits: Number
});

const visits = mongoose.model("visits", visitSchema);

app.get("/home", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");

  try {
    const posts = await PosT.find().exec();
    const sortedPosts = await PosT.find().sort({ like: "desc" }).exec();
    const userProfile = await Profile.findOne({ email: req.session.useremail }).lean();

    // Debugging log: Verify userProfile data
    console.log("Profile Data:", JSON.stringify(userProfile, null, 2));

    res.render("home", {
      user: req.session.username,
      posts,
      date: Date.now(),
      sposts: sortedPosts,
      notifications: userProfile?.notifications || [], // Fallback to empty array
    });
  } catch (err) {
    console.error("Route Error:", err);
    res.render("home", {
      user: req.session.username,
      posts: [],
      sposts: [],
      notifications: [], // Explicit fallback
    });
  }
});

app.post("/clear-notifications", (req, res) => {
  // Assuming `req.session.notifications` stores notifications
  req.session.notifications = [];

  // Respond with success
  res.json({ success: true });
});

app.get("/", (req, res) => {
  res.render("login");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  imagename=null
  res.redirect("/");
});
app.get("/signup",(req,res)=>{
  res.redirect("/")
})
app.post("/signup", async (req, res) => {

  const userExists = await Profile.exists({ username:req.body.name });
  // const loginData = {
  //   name: req.body.name,
  //   email: req.body.email,
  //   password: req.body.password,
  //   type: "user",
  // };
  if(!userExists){
  const profileData = {
    username: req.body.name,
    email: req.body.email,
    password: req.body.password,
    type: "user",
    fullname:req.body.name,
    dp: "",
    bio: "",
    weblink: "",
    facebook: "",
    whatsapp: "",
    twitter: "",
    instagram: "",
    phoneno: "",
  };

  // await collection.insertMany(loginData);
  await Profile.insertMany(profileData)
  req.session.useremail = req.body.email;
  req.session.username = req.body.name;
  res.redirect("home");
}else{
  res.send("<script>alert('user already exits');window.location.href = '/'</script>");

}
});

app.post("/login", async (req, res) => {
  try {
    const check = await Profile.findOne({ email: req.body.email });
    if (check.password === req.body.password) {
      if (check.type === "admin") {
        req.session.useremail = check.email;
        req.session.username = check.username;
        req.session.type = "admin"
        res.redirect("admin")
      } else {
        visits.findOneAndUpdate(
          { _id: "640cb99cd1ab2ecb248598b4" },
          { $inc: { visits: 1 } },
          (err) => {});
        req.session.useremail = check.email;
        req.session.username = check.username;
        req.session.type = "user"
        console.log(req.session.user);
        res.redirect("home");
      }
    } else {
      res.send("<script>alert('Wrong Password');window.location.href = '/'</script>");
    }
  } catch {
    res.send("<script>alert('Wrong details');window.location.href = '/'</script>");
  }
});

// --------------------------
// Subscription Management Routes
// --------------------------

// GET: Render a page where the user can subscribe/unsubscribe to topics
app.get("/subscriptions", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  try {
    const userProfile = await Profile.findOne({ email: req.session.useremail });
    res.render("subscriptions", { subscriptions: userProfile.subscriptions });
  } catch (err) {
    console.error(err);
    res.send("Error retrieving subscriptions");
  }
});

// POST: Subscribe to a topic (from the search bar form)
app.post("/subscriptions/subscribe", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  const topic = req.body.topic && req.body.topic.trim();
  if (!topic) return res.redirect("/subscriptions");
  try {
// Use $addToSet to avoid duplicates
    await Profile.updateOne(
        { email: req.session.useremail },
        { $addToSet: { subscriptions: topic } }
    );
    res.redirect("/subscriptions");
  } catch (err) {
    console.error(err);
    res.send("Error subscribing to the topic.");
  }
});

// POST: Unsubscribe from a topic
app.post("/subscriptions/unsubscribe", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  const topic = req.body.topic;
  try {
    await Profile.updateOne({ email: req.session.useremail }, { $pull: { subscriptions: topic } });
    res.redirect("/subscriptions");
  } catch (err) {
    console.error(err);
    res.send("Error unsubscribing from the topic.");
  }
});

// --------------------------
// New Post (Compose) Routes – Updated to Notify Subscribers
// --------------------------

// GET: Render the compose view (a form to submit a new post)
app.get("/compose", (req, res) => {
  if (req.session.username) {
    res.render("compose", { user: req.session.username });
  } else {
    // Redirect to login if user is not logged in
    res.redirect("/");
  }
});

// app.post("/compose", upload.single("image"), async (req, res) => {
//   try {
//     const postData = {
//       author: req.session.username,
//       title: req.body.postTitle,
//       content: req.body.postBody,
//       thumbnail: imagename,
//       date: Date.now(),
//       like: 0,
//     };
//     const newPost = await PosT.create(postData);
//
//     // Notify users subscribed to topics matching the post title
//     const profiles = await Profile.find({
//       subscriptions: { $exists: true, $not: { $size: 0 } },
//     });
//
//     for (const profile of profiles) {
//       for (const topic of profile.subscriptions) {
//         if (newPost.title.toLowerCase().includes(topic.toLowerCase())) {
//           const notification = {
//             postId: newPost._id,
//             topic,
//             message: `A new post titled "${newPost.title}" about "${topic}" has been published.`,
//             date: new Date(),
//           };
//           await Profile.updateOne(
//               { _id: profile._id },
//               { $push: { notifications: notification } }
//           );
//         }
//       }
//     }
//
//     res.redirect("/home");
//   } catch (err) {
//     console.error("Error creating post or sending notifications:", err);
//     res.status(500).send("Error creating post or sending notifications.");
//   }
// });


const { indexPost } = require("../elasticsearch/elasticsearchOperations");

app.post("/compose", upload.single("image"), async (req, res) => {
  try {
    const postData = {
      author: req.session.username,
      title: req.body.postTitle,
      content: req.body.postBody,
      thumbnail: imagename,
      date: Date.now(),
      like: 0,
    };
    // Save the post in MongoDB (or your primary datastore)
    const newPost = await PosT.create(postData);
    console.log("New post created with id:", newPost._id.toString());
    // Now index the new post in Elasticsearch
    await indexPost(newPost);

    // Notify users subscribed to topics matching the post title
    const profiles = await Profile.find({
      subscriptions: { $exists: true, $not: { $size: 0 } },
    });

    for (const profile of profiles) {
      for (const topic of profile.subscriptions) {
        if (newPost.title.toLowerCase().includes(topic.toLowerCase())) {
          const notification = {
            postId: newPost._id,
            topic,
            message: `A new post titled "${newPost.title}" about "${topic}" has been published.`,
            date: new Date(),
          };
          await Profile.updateOne(
              { _id: profile._id },
              { $push: { notifications: notification } }
          );
        }
      }
    }

    res.redirect("/home");
  } catch (err) {
    console.error("Error creating post, indexing, or sending notifications:", err);
    res.status(500).send("Error creating post, indexing, or sending notifications.");
  }
});

app.post("/update/:custom", upload.single("image"), async (req, res) => {
  try {
    // Update the post in MongoDB
    const updatedPost = await PosT.findByIdAndUpdate(
        req.params.custom,
        {
          title: req.body.postTitle,
          content: req.body.postBody,
          thumbnail: imagename,
        },
        { new: true }
    );
    if (!updatedPost) {
      return res.status(404).send("Post not found");
    }

    // Update the post in ElasticSearch
    await esClient.update({
      index: 'posts',
      id: updatedPost._id.toString(),
      body: {
        doc: {
          title: updatedPost.title,
          content: updatedPost.content,
          thumbnail: updatedPost.thumbnail,
          // Include any fields you need to update
        }
      }
    });
    res.redirect("/posts/" + req.params.custom);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Error updating post");
  }
});


// app.get("/posts/:custom", (req, res) => {
//    if(req.session.username){
//   PosT.find((err, results) => {
//     res.render("posts", {
//       user: req.session.username,
//       posts: results,
//       date: Date.now(),
//       id: req.params.custom,
//     });
//   });
// }else{
//   res.render("notfound")
// }
// });

// Add to existing posts route
app.get("/posts/:id", async (req, res) => {
  try {
    if (!req.session.username) return res.render("notfound");

    const post = await PosT.findById(req.params.id).lean();
    if (!post) return res.render("notfound");

    const allPosts = await PosT.find().lean();

    res.render("posts", {
      user: req.session.username,
      post: post,         // Single post document
      posts: allPosts,    // All posts for related articles
      date: Date.now()
    });
  } catch (err) {
    console.error("Post retrieval error:", err);
    res.render("notfound");
  }
});

// New comment submission route
app.post("/posts/:id/comment", (req, res) => {
  if(!req.session.username) return res.redirect("/");

  const newComment = {
    user: req.session.username,
    text: req.body.commentText,
    date: new Date()
  };

  PosT.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: newComment } },
      { new: true },
      (err, updatedPost) => {
        if(err) {
          console.error("Comment error:", err);
          return res.status(500).send("Error saving comment");
        }
        res.redirect(`/posts/${req.params.id}`);
      }
  );
});


app.post("/posts/:custom", (req, res) => {
  const id = req.params.custom;
  var userid = req.session.username;

  PosT.findOne({ _id: { $eq: id } }, (err, result) => {
    if (result.likedby.includes(userid)) {
      PosT.findOneAndUpdate(
        { _id: id },
        { $pull: { likedby: userid } },
        { new: true }
      ).exec((err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log("user disliked");

          PosT.findOneAndUpdate({ _id: id }, { $inc: { like: -1 } }, (err) => {
            if (err) {
              console.log(err);
            } else {
              console.log("updated");
            }
          });
        }
      });
    } else {
      PosT.findOneAndUpdate(
        { _id: id },
        { $push: { likedby: userid } },
        { new: true }
      ).exec((err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log("user liked");
          PosT.findOneAndUpdate({ _id: id }, { $inc: { like: 1 } }, (err) => {
            if (err) {
              console.log(err);
            } else {
              console.log("updated");
            }
          }); //
        }
      });
    }
    if (err) {
      console.log(err);
    }
  });
});

app.get("/update/:custom",(req,res)=>{
   if(req.session.username){
  PosT.findById(req.params.custom,(err,result)=>{
    console.log(result);
     if(req.session.username===result.author||req.session.username==="admin"){
    res.render("edit-post",{user:req.session.username,post:result})
     }else{
      res.render("notfound")
     }
  })
}
})
app.post("/update/:custom", upload.single("image"), async (req, res) => {
  PosT.findByIdAndUpdate(
    req.params.custom,
    {
      title:req.body.postTitle,
      content: req.body.postBody,
      thumbnail: imagename,
    },
    (err) => {
      if (err) {
        console.log(err);
      }
    }
  );
  res.redirect("/posts/" + req.params.custom);
});

app.get("/delete/:custom", (req, res) => {
 if(req.session.username){
  PosT.findById(req.params.custom,(err,results)=>{
     if (
       req.session.username === results.author ||
       req.session.type === "admin"
     ){
       PosT.findByIdAndRemove(req.params.custom, (err) => {
         console.log("deleted");
         if (req.session.username === "admin") {
           res.redirect("/admin");
         } else {
           res.redirect("/home");
         }
       });
      }else{
        res.render("notfound")
      }
  })

}else{
  res.redirect("/")
}
});


app.get("/profile/:customRoute", (req, res) => {

  if(req.session.username){
  const customRoute = req.params.customRoute;
// Profile.findOne({username:req.session.username},(err,result)=>{
//   if(err){
//     console.log(err);
//   }else{
//   console.log(result.dp);
//   }
// })

  PosT.find({ author: customRoute}, (err, result)=> {
    if (err){
        console.log(err);

    }
    else{
        req.session.userposts=result;
        Profile.findOne({username:customRoute},(err,results)=>{
          res.render("profile", {
          username: req.session.username,
          posts: req.session.userposts,
          userdata:results,
          date: Date.now(),
        });
        // console.log(results);
        })


    }})
    // console.log(req.session.userposts);
  }else{
    res.redirect("/")
  }
});


app.get("/editprofile/:custom",(req,res)=>{
  if(req.session.username){
     Profile.findOne({username:req.params.custom},(err,results)=>{
     if (req.session.username === results.username){
  Profile.findOne({username:req.session.username},(err,result)=>{
    res.render("edit-profile",{username:req.session.username,email:req.session.useremail,userdata:result})
  })}else{
    res.render("notfound")
  }})
}else{
  res.redirect("/")
}
})


app.post("/editprofile/:custom",upload.single("image"), async (req, res) => {
  const custom=req.params.custom


// console.log(imagename);
  Profile.findOneAndUpdate(
    { username: req.session.username },
    {
      fullname: req.body.fullname,
      email: req.session.useremail,
      dp: imagename,
      bio: req.body.bio,
      weblink: req.body.weblink,
      facebook: req.body.fb,
      whatsapp: req.body.wa,
      twitter: req.body.tw,
      instagram: req.body.insta,
      phoneno: req.body.phno,
    },
    (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("updated");
      }
    }
  );


  res.redirect("/profile/"+custom);
});

app.get("/admin",(req,res)=>{
  if(req.session.type==="admin"){
  // collection.find((err,logins)=>{
    Profile.find((err,profiles)=>{
      PosT.find((err,posts)=>{
        visits.find((err,visits)=>{
         res.render("admin",{profiles:profiles,posts:posts,visits:visits,username:req.session.username});
        })
      })
    })
  }else{
    res.redirect("/")
  }
  // })

})

app.get("/removeuser/:custom", (req, res) => {
  if(req.session.type==="admin"){
  Profile.findByIdAndRemove(req.params.custom, (err) => {
    PosT.deleteMany({author:{$eq:req.query.user}},(err)=>{
      if(err){
        console.log(err);
      }else{
        res.redirect("/admin")
      }
    })
  });
}else{
  res.render("notfound")
}
});




app.post("/search",async(req,res)=>{
  let payload=req.body.payload.trim()
  // console.log(payload);
  let search=await PosT.find({title:{$regex: new RegExp('^'+payload+'.*','i')}}).exec();
  search = search.slice(0,10)
  // console.log(search);
  res.send({payload:search})

})

// // Route to generate an AI reply for a post (you can adjust the URL as needed)
// app.post("/generate-reply", async (req, res) => {
//   // Check if user is logged in
//   if (!req.session.username) return res.status(401).json({ error: "Not logged in" });
//
//   const { postId, useAI } = req.body;
//
//   // Make sure the toggle (useAI) is enabled
//   if (!useAI) {
//     return res.status(400).json({ error: "AI reply generation not enabled" });
//   }
//
//   try {
//     // Find the post by id
//     const post = await PosT.findById(postId).lean();
//     if (!post) return res.status(404).json({ error: "Post not found" });
//
//     // Create a prompt based on the post content or title.
//     const prompt = `Generate a thoughtful reply for the post titled "${post.title}" with content: ${post.content}`;
//
//     // Call the OpenAI API to generate a reply
//     const aiReply = await generateReply(prompt);
//
//     // Option: Save the AI reply as a comment in the post's comments array.
//     const newComment = {
//       user: "AI Assistant",
//       text: aiReply,
//       date: new Date(),
//     };
//
//     await PosT.findByIdAndUpdate(postId, { $push: { comments: newComment } });
//
//     // Return the generated reply (and optionally the updated comment list)
//     res.json({ success: true, reply: aiReply });
//   } catch (err) {
//     console.error("Error generating AI reply:", err);
//     res.status(500).json({ error: "Error generating reply" });
//   }
// });
//


app.post("/generate-reply", async (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: "Not logged in" });

  const { postId, useAI, prompt } = req.body;

  if (!useAI) {
    return res.status(400).json({ error: "AI reply generation not enabled" });
  }

  try {
    // Find the post by id
    const post = await PosT.findById(postId).lean();
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Use the prompt provided by the user or fall back to a default prompt
    const promptToSend = prompt && prompt.length > 0 ? prompt :
        `Generate a thoughtful reply for the post titled "${post.title}" with content: ${post.content}`;

    // Call the OpenAI API to generate a reply
    const aiReply = await generateReply(promptToSend);

    // Save the AI reply as a comment in the post's comments array
    const newComment = {
      user: "AI Assistant",
      text: aiReply,
      date: new Date(),
    };

    await PosT.findByIdAndUpdate(postId, { $push: { comments: newComment } });

    // Return the generated reply in the JSON response
    res.json({ success: true, reply: aiReply });
  } catch (err) {
    console.error("Error generating AI reply:", err);
    res.status(500).json({ error: "Error generating reply" });
  }
});


// AI Agent GET route: renders the AI Agent page
app.get("/ai-agent", (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  res.render("ai-agent", { user: req.session.username });
});

// AI Agent POST route: processes the user's query and returns recommendations
app.post("/ai-agent", async (req, res) => {
  const userQuery = req.body.query;

  try {
    // Example steps to generate a recommendation:
    // 1. Get user's location (you might use req.ip or a client-side geolocation API)
    //    For demonstration, we use a placeholder:
    const locationData = await axios.get('https://ipapi.co/json/');
    const userLocation = locationData.data.city || 'your area';

    // 2. Get current weather conditions (example using Open-Meteo or OpenWeatherMap)
    //    Replace the URL and parameters with actual API calls and include your API key if needed.
    const weatherResponse = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: locationData.data.latitude,
        longitude: locationData.data.longitude,
        current_weather: true
      }
    });
    const weather = weatherResponse.data.current_weather;

    // 3. Get real-time event information (e.g., sports events) using a service like SerpAPI.
    //    Here we use a placeholder response.
    const events = "Local sports event: City Marathon at 3 PM";

    // 4. Ask OpenAI for an activity recommendation based on the above data.
    //    Make sure to have your API key in an environment variable or configuration.
    //    This is a placeholder call—you need to integrate the actual OpenAI API.
    const openAiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are an assistant that recommends activities based on weather, local events, and user location." },
            { role: "user", content: `I am in ${userLocation}. The current weather is ${weather.temperature}°C with ${weather.weathercode}. I also heard about this event: ${events}. What activities would you recommend?` }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`  // Replace with your actual OpenAI API key
          }
        }
    );

    const recommendation = openAiResponse.data.choices[0].message.content;
    res.json({ recommendation });
  } catch (error) {
    console.error("Error in AI Agent:", error.message);
    res.status(500).json({ recommendation: "Sorry, we couldn't fetch recommendations at this time." });
  }
});

app.get("/:custom", (req, res) => {
  res.render("notfound")
});
app.get("/:custom/:custom2",(req,res)=>{
  res.render("notfound")
})

app.listen(process.env.PORT || 3000, () => {
  console.log("server started at port 3000");
});