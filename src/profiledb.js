const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(
      "mongodb+srv://arjuncvinod:gdozFKJP7i12I87s@cluster0.yjxy0xp.mongodb.net/todoListDB",
      { useNewUrlParser: true }
  );
  console.log("profile connected");
}
main();

const profileSchema = new mongoose.Schema({
  username: String,
  fullname: String,
  email: String,
  password: String,
  type: String,
  dp: String,
  bio: String,
  weblink: String,
  facebook: String,
  whatsapp: String,
  twitter: String,
  instagram: String,
  phoneno: String,
// New fields for subscriptions and notifications:
  subscriptions: { type: [String], default: [] },
  notifications: {
    type: [
      {
        postId: mongoose.Schema.Types.ObjectId,
        topic: String,
        message: String,
        date: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
});

const Profile = mongoose.model("profile", profileSchema);
module.exports = Profile;