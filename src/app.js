require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const path = require("path");
const sessions = require("express-session");
const multer = require("multer");
const ejs = require("ejs");

const { generateReply, generateRecommendations } = require("../openaihelper/openai");
const PosT = require("./postdb");
const Profile = require("./profiledb");
const { indexPost } = require("../elasticsearch/elasticsearchOperations");

const app = express();
let imagename;

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./public/thumbnails"),
  filename:   (req, file, cb) => {
    cb(null, file.originalname);
    imagename = file.originalname;
  },
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "../public")));
app.set("view engine", "ejs");
app.use(
    sessions({
      secret: "secret key",
      saveUninitialized: true,
      resave: false,
    })
);

// ---------------------------------
// Authentication & Home
// ---------------------------------
app.get("/", (req, res) => {
  res.render("login");
});

// *BEFORE* your app.get("/:custom") catch‑all:
app.get("/recommendations", (req, res) => {
  if (!req.session.useremail) {
    return res.redirect("/");
  }
  // pass in anything your template needs (e.g. user, notifications)
  res.render("recommendations", {
    user: req.session.username,
    notifications: req.session.notifications || []
  });
});

app.post("/api/recommendations", async (req, res) => {
  // Debug log
  console.log("◀️ POST /api/recommendations got:", req.body);

  try {
    const { location, weather } = req.body;
    // अगर client से location नहीं आया तो fallback
    const userLoc = location || (await axios.get("https://ipapi.co/json/")).data;
    const locString = typeof userLoc === "string"
        ? userLoc
        : `${userLoc.latitude},${userLoc.longitude}`;

    // OpenAI से recommendations जेनरेट करो
    const recommendations = await generateRecommendations(locString, weather);
    return res.json({ recommendations });
  } catch (err) {
    console.error("❌ /api/recommendations POST error:", err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});


app.post("/signup", async (req, res) => {
  const userExists = await Profile.exists({ username: req.body.name });
  if (!userExists) {
    await Profile.create({
      username: req.body.name,
      email: req.body.email,
      password: req.body.password,
      type: "user",
      fullname: req.body.name,
      dp: "",
      bio: "",
      weblink: "",
      facebook: "",
      whatsapp: "",
      twitter: "",
      instagram: "",
      phoneno: "",
      subscriptions: [],
      notifications: [],
    });
    req.session.useremail = req.body.email;
    req.session.username  = req.body.name;
    return res.redirect("/home");
  }
  res.send("<script>alert('User already exists');window.location='/'</script>");
});

app.post("/login", async (req, res) => {
  try {
    const user = await Profile.findOne({ email: req.body.email });
    if (!user || user.password !== req.body.password) {
      throw new Error("Invalid credentials");
    }
    req.session.useremail = user.email;
    req.session.username  = user.username;
    req.session.type      = user.type;

    if (user.type === "admin") {
      return res.redirect("/admin");
    } else {
      // increment visit counter for non-admins
      // (assuming a single visits document exists)
      mongoose.model("visits").findByIdAndUpdate(
          "640cb99cd1ab2ecb248598b4",
          { $inc: { visits: 1 } },
          () => {}
      );
      return res.redirect("/home");
    }
  } catch (err) {
    return res.send("<script>alert('Wrong details');window.location='/'</script>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  imagename = null;
  res.redirect("/");
});

app.get("/home", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  try {
    const posts   = await PosT.find().lean();
    const sposts  = await PosT.find().sort({ like: -1 }).lean();
    const profile = await Profile.findOne({ email: req.session.useremail }).lean();

    res.render("home", {
      user:          req.session.username,
      posts,
      sposts,
      date:          Date.now(),
      notifications: profile.notifications || [],
    });
  } catch (err) {
    console.error(err);
    res.render("home", {
      user:          req.session.username,
      posts:         [],
      sposts:        [],
      date:          Date.now(),
      notifications: [],
    });
  }
});

// ---------------------------------
// Subscription Management
// ---------------------------------
app.get("/subscriptions", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  const profile = await Profile.findOne({ email: req.session.useremail }).lean();
  res.render("subscriptions", { subscriptions: profile.subscriptions });
});

app.post("/subscriptions/subscribe", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  const topic = req.body.topic && req.body.topic.trim();
  if (topic) {
    await Profile.updateOne(
        { email: req.session.useremail },
        { $addToSet: { subscriptions: topic } }
    );
  }
  res.redirect("/subscriptions");
});

app.post("/subscriptions/unsubscribe", async (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  await Profile.updateOne(
      { email: req.session.useremail },
      { $pull: { subscriptions: req.body.topic } }
  );
  res.redirect("/subscriptions");
});

// ---------------------------------
// Compose & Notifications
// ---------------------------------
app.get("/compose", (req, res) => {
  if (!req.session.username) return res.redirect("/");
  res.render("compose", { user: req.session.username });
});

app.post("/compose", upload.single("image"), async (req, res) => {
  try {
    const postData = {
      author:    req.session.username,
      title:     req.body.postTitle,
      content:   req.body.postBody,
      thumbnail: imagename,
      date:      Date.now(),
      like:      0,
    };
    const newPost = await PosT.create(postData);
    await indexPost(newPost);

    // Notify topic subscribers
    const profiles = await Profile.find({
      subscriptions: { $exists: true, $not: { $size: 0 } },
    });
    for (const prof of profiles) {
      for (const topic of prof.subscriptions) {
        if (newPost.title.toLowerCase().includes(topic.toLowerCase())) {
          const notification = {
            postId: prof._id,
            topic,
            message: `A new post titled "${newPost.title}" about "${topic}" has been published.`,
            date: new Date(),
          };
          await Profile.updateOne(
              { _id: prof._id },
              { $push: { notifications: notification } }
          );
        }
      }
    }

    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating post or sending notifications.");
  }
});

// ---------------------------------
// Update Post
// ---------------------------------
app.get("/update/:custom", (req, res) => {
  if (!req.session.username) return res.redirect("/");
  PosT.findById(req.params.custom, (err, post) => {
    if (err || !post) return res.render("notfound");
    if (req.session.username === post.author || req.session.type === "admin") {
      return res.render("edit-post", {
        user: req.session.username,
        post,
      });
    }
    res.render("notfound");
  });
});

app.post("/update/:custom", upload.single("image"), async (req, res) => {
  try {
    await PosT.findByIdAndUpdate(req.params.custom, {
      title:     req.body.postTitle,
      content:   req.body.postBody,
      thumbnail: imagename,
    });
    res.redirect(`/posts/${req.params.custom}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating post");
  }
});

// ---------------------------------
// Delete Post
// ---------------------------------
app.get("/delete/:custom", (req, res) => {
  if (!req.session.username) return res.redirect("/");
  PosT.findById(req.params.custom, (err, post) => {
    if (
        err ||
        !post ||
        (req.session.username !== post.author && req.session.type !== "admin")
    ) {
      return res.render("notfound");
    }
    PosT.findByIdAndRemove(req.params.custom, () => {
      res.redirect(req.session.type === "admin" ? "/admin" : "/home");
    });
  });
});

// ---------------------------------
// View Single Post & Comment
// ---------------------------------
app.get("/posts/:id", async (req, res) => {
  if (!req.session.username) return res.render("notfound");
  const post     = await PosT.findById(req.params.id).lean();
  const allPosts = await PosT.find().lean();
  if (!post) return res.render("notfound");
  res.render("posts", {
    user: req.session.username,
    post,
    posts: allPosts,
    date: Date.now(),
  });
});

app.post("/posts/:custom", async (req, res) => {
  // Like/unlike logic
  const id     = req.params.custom;
  const userId = req.session.username;
  const post   = await PosT.findById(id);
  if (!post) return res.redirect(`/posts/${id}`);

  if (post.likedby.includes(userId)) {
    await PosT.findByIdAndUpdate(id, {
      $pull: { likedby: userId },
      $inc:  { like: -1 },
    });
  } else {
    await PosT.findByIdAndUpdate(id, {
      $push: { likedby: userId },
      $inc:  { like: 1 },
    });
  }
  res.redirect(`/posts/${id}`);
});

app.post("/posts/:id/comment", (req, res) => {
  if (!req.session.username) return res.redirect("/");
  const newComment = {
    user: req.session.username,
    text: req.body.commentText,
    date: new Date(),
  };
  PosT.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: newComment } },
      () => res.redirect(`/posts/${req.params.id}`)
  );
});

// ---------------------------------
// Profile & Edit Profile
// ---------------------------------
app.get("/profile/:customRoute", async (req, res) => {
  if (!req.session.username) return res.redirect("/");
  const posts = await PosT.find({ author: req.params.customRoute }).lean();
  const userdata = await Profile.findOne({ username: req.params.customRoute }).lean();
  res.render("profile", {
    username: req.session.username,
    posts,
    userdata,
    date: Date.now(),
  });
});

app.get("/editprofile/:custom", async (req, res) => {
  if (!req.session.username) return res.redirect("/");
  const userdata = await Profile.findOne({ username: req.params.custom }).lean();
  if (req.session.username !== userdata.username) return res.render("notfound");
  res.render("edit-profile", {
    username: req.session.username,
    email:    req.session.useremail,
    userdata,
  });
});

app.post("/editprofile/:custom", upload.single("image"), async (req, res) => {
  await Profile.findOneAndUpdate(
      { username: req.session.username },
      {
        fullname: req.body.fullname,
        dp:       imagename,
        bio:      req.body.bio,
        weblink:  req.body.weblink,
        facebook: req.body.fb,
        whatsapp: req.body.wa,
        twitter:  req.body.tw,
        instagram:req.body.insta,
        phoneno:  req.body.phno,
      }
  );
  res.redirect(`/profile/${req.params.custom}`);
});

// ---------------------------------
// Admin Dashboard & User Removal
// ---------------------------------
app.get("/admin", async (req, res) => {
  if (req.session.type !== "admin") return res.redirect("/");
  const profiles = await Profile.find().lean();
  const posts    = await PosT.find().lean();
  const visits   = await mongoose.model("visits").find().lean();
  res.render("admin", {
    profiles,
    posts,
    visits,
    username: req.session.username,
  });
});

app.get("/removeuser/:custom", async (req, res) => {
  if (req.session.type !== "admin") return res.render("notfound");
  await Profile.findByIdAndRemove(req.params.custom);
  await PosT.deleteMany({ author: req.query.user });
  res.redirect("/admin");
});

// ---------------------------------
// Search
// ---------------------------------
app.post("/search", async (req, res) => {
  const payload = req.body.payload.trim();
  let results   = await PosT.find({
    title: { $regex: new RegExp("^" + payload + ".*", "i") },
  })
      .lean()
      .exec();
  results = results.slice(0, 10);
  res.json({ payload: results });
});

// ---------------------------------
// AI Reply Generation
// ---------------------------------
app.post("/generate-reply", async (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: "Not logged in" });
  const { postId, useAI, prompt } = req.body;
  if (!useAI) return res.status(400).json({ error: "AI not enabled" });

  const post = await PosT.findById(postId).lean();
  if (!post) return res.status(404).json({ error: "Post not found" });

  const promptToSend =
      prompt && prompt.length > 0
          ? prompt
          : `Generate a thoughtful reply for the post titled "${post.title}" with content: ${post.content}`;

  try {
    const aiReply = await generateReply(promptToSend);
    await PosT.findByIdAndUpdate(postId, {
      $push: { comments: { user: "AI Assistant", text: aiReply, date: new Date() } },
    });
    res.json({ success: true, reply: aiReply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generating reply" });
  }
});

// ---------------------------------
// AI Agent Page
// ---------------------------------
app.get("/ai-agent", (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  res.render("ai-agent", { user: req.session.username });
});

app.post("/ai-agent", async (req, res) => {
  try {
    const locRes = await axios.get("https://ipapi.co/json/");
    const userLocation = locRes.data.city || locRes.data.region || "your area";

    const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude:       locRes.data.latitude,
        longitude:      locRes.data.longitude,
        current_weather: true,
      },
    });
    const weather = weatherRes.data.current_weather;
    const events  = "City Marathon at 3 PM";

    const aiRes = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                  "You are an assistant that recommends activities based on weather, local events, and user location.",
            },
            {
              role: "user",
              content: `I am in ${userLocation}. The current weather is ${weather.temperature}°C (code ${weather.weathercode}). I also heard about: ${events}. What do you recommend?`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
    );

    res.json({ recommendation: aiRes.data.choices[0].message.content });
  } catch (err) {
    console.error("AI Agent error:", err);
    res.status(500).json({ recommendation: "Sorry, couldn't fetch recommendations." });
  }
});

// ---------------------------------
// Recommendations Page & API
// ---------------------------------
app.get("/recommendations", (req, res) => {
  if (!req.session.useremail) return res.redirect("/");
  res.render("recommendations", { user: req.session.username });
});

app.get("/api/recommendations", async (req, res) => {
  if (!req.session.useremail) return res.status(401).json({ error: "Not logged in" });

  try {
    const locRes = await axios.get("https://ipapi.co/json/");
    const userLocation = locRes.data.city || locRes.data.region || "your area";

    const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude:       locRes.data.latitude,
        longitude:      locRes.data.longitude,
        current_weather: true,
      },
    });
    const weather = weatherRes.data.current_weather;

    const recommendations = await generateRecommendations(userLocation, weather);
    res.json({ recommendations });
  } catch (err) {
    console.error("Recommendations API error:", err);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// ---------------------------------
// Fallback (404)
// ---------------------------------
app.get("/:custom",    (req, res) => res.render("notfound"));
app.get("/:custom/:c2", (req, res) => res.render("notfound"));

// ---------------------------------
// Start Server
// ---------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
