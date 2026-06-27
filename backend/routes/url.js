import express from "express";
import Url from "../models/Url.js";
import { nanoid } from "nanoid";

const router = express.Router();

router.post("/shorten", async (req, res) => {
  try {
    const { originalUrl } = req.body;
    if (!originalUrl) {
      return res.status(400).json({ error: "Original URL is required" });
    }

    let shortId = nanoid(7);
    let exist = await Url.findOne({ shortId });

    while (exist) {
      shortId = nanoid(7);
      exist = await Url.findOne({ shortId });
    }

    const url = await Url.create({ shortId, originalUrl });
    res.json({
      shortId: url.shortId,
      shortUrl: `${process.env.BASE_URL}/${url.shortId}`,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server Error" });
  }
});

router.get("/:shortId", async (req, res) => {
  try {
    const { shortId } = req.params;
    const url = await Url.findOne({ shortId });
    if (!url) {
      return res.status(404).json({ error: "URL not found" });
    }

    // check expiry
    if (url.expiresAt < new Date()) {
      return res.status(410).json({ error: "This link has expired" });
    }
    
    url.clicks += 1;
    await url.save();
    return res.redirect(url.originalUrl);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;