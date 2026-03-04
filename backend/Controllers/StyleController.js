const { GoogleGenerativeAI } = require("@google/generative-ai");
const Message = require("../Models/messageModel");
const User = require("../Models/UserModel");
const asyncHandler = require("express-async-handler");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateProfileFromMessages = async (messages) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const userMessages = messages
    .reverse()
    .filter((msg) => msg.isCurrentUser)
    .slice(-200)
    .map((msg) => msg.content)
    .join("\n");

  if (!userMessages) {
    return {
      voice: "default",
      tone_level: 50,
      formality: "neutral",
      emoji_usage: "sometimes",
      avg_sentence_length: "medium",
      greeting_phrases: [],
      sign_offs: [],
      common_expressions: [],
      punctuation_style: "standard",
      slang_or_regionalisms: [],
      quirks: [],
      length_preference: "2-3 sentences",
      safety_notes: "",
    };
  }

  const prompt = `
System:
You are a writing-style analyzer. Extract a concise style profile from the user's messages.
Return strict JSON only.

User messages (chronological, newest last):
${userMessages}

Return JSON with this schema:
{
  "voice": "short description (e.g., laid-back, formal, witty)",
  "tone_level": 0-100,
  "formality": "casual|neutral|formal",
  "emoji_usage": "never|rare|sometimes|often",
  "avg_sentence_length": "short|medium|long",
  "greeting_phrases": ["..."],
  "sign_offs": ["..."],
  "common_expressions": ["..."],
  "punctuation_style": "e.g., minimal, lots of exclamation, ellipses",
  "slang_or_regionalisms": ["..."],
  "quirks": ["..."],
  "length_preference": "1 sentence|2-3 sentences|short paragraph",
  "safety_notes": "anything to avoid (e.g., hates emojis, avoids sarcasm)"
}`;

  try {
    console.log("Creating style profile with Gemini prompt:", prompt);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini response text for style profile:", text);
    const jsonResponse = JSON.parse(
      text.replace(/```json/g, "").replace(/```/g, "")
    );
    return jsonResponse;
  } catch (error) {
    console.error("Error creating style profile with Gemini:", error);
    return {
      voice: "default",
      tone_level: 50,
      formality: "neutral",
      emoji_usage: "sometimes",
      avg_sentence_length: "medium",
      greeting_phrases: [],
      sign_offs: [],
      common_expressions: [],
      punctuation_style: "standard",
      slang_or_regionalisms: [],
      quirks: [],
      length_preference: "2-3 sentences",
      safety_notes: "Error during profile generation.",
    };
  }
};

const createOrUpdateStyleProfile = asyncHandler(async (req, res) => {
  const { decryptedMessages } = req.body;
  const userId = req.user.id;

  if (
    !decryptedMessages ||
    !Array.isArray(decryptedMessages) ||
    decryptedMessages.length === 0
  ) {
    return res
      .status(400)
      .json({
        success: false,
        error: "No messages provided for profile creation",
      });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  const newStyleProfile = await generateProfileFromMessages(decryptedMessages);
  user.styleProfile = newStyleProfile;
  await user.save();

  res.json({
    success: true,
    message: "Style profile updated successfully.",
    styleProfile: user.styleProfile,
  });
});

const generateReplySuggestions = async (styleProfile, recentMessages) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1024,
      },
    });

    const prompt = `
You are a writing assistant that generates reply suggestions matching a user's communication style.

User's Communication Style Profile:
- Voice: ${styleProfile.voice}
- Tone Level: ${styleProfile.tone_level}/100
- Formality: ${styleProfile.formality}
- Emoji Usage: ${styleProfile.emoji_usage}
- Average Sentence Length: ${styleProfile.avg_sentence_length}
- Preferred Length: ${styleProfile.length_preference}
- Punctuation Style: ${styleProfile.punctuation_style}
- Common Expressions: ${
      styleProfile.common_expressions.join(", ") || "None identified"
    }

Recent Conversation Context:
${recentMessages
  .slice(-5)
  .map((msg) => `${msg.sender}: ${msg.content}`)
  .join("\n")}

Generate exactly 3 reply suggestions that:
1. Match the user's communication style
2. Are contextually appropriate responses
3. Vary in approach (brief/detailed/alternative tone)

Return only a valid JSON array of strings:
["suggestion1", "suggestion2", "suggestion3"]

Do not include any other text or explanation.`;
    console.log("Gemini prompt:", prompt);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini response text:", text);
    let suggestions;
    try {
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON array found");
      }
      if (!Array.isArray(suggestions) || suggestions.length !== 3) {
        throw new Error("Invalid suggestions format");
      }
    } catch (parseError) {
      console.log("JSON parsing failed, using fallback suggestions");
      const fallbacks = getFallbackSuggestions(styleProfile, recentMessages);
      suggestions = fallbacks;
    }

    return suggestions;
  } catch (error) {
    console.error("Error generating suggestions with Gemini:", error);
    return getFallbackSuggestions(styleProfile, recentMessages);
  }
};

const getFallbackSuggestions = (styleProfile, recentMessages) => {
  const casual = styleProfile.formality === "casual";
  const emojis = styleProfile.emoji_usage === "often";

  const base = [
    casual ? "That's interesting!" : "I find that quite interesting.",
    casual ? "Tell me more about that" : "Could you elaborate on that?",
    casual ? "What do you think?" : "What are your thoughts on this matter?",
  ];

  if (emojis) {
    return base.map((suggestion) => suggestion + " 👍");
  }

  return base;
};

const analyzeUserStyle = async (req, res) => {
  try {
    const { chatId, decryptedMessages } = req.body;
    const userId = req.user.id;
    if (
      !decryptedMessages ||
      !Array.isArray(decryptedMessages) ||
      decryptedMessages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "No messages provided for analysis",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const styleProfile = user.styleProfile || {
      voice: "default",
      formality: "neutral",
    };
    const suggestions = await generateReplySuggestions(
      styleProfile,
      decryptedMessages
    );

    res.json({
      success: true,
      suggestions,
      styleProfile: user.styleProfile,
      messageCount: decryptedMessages.length,
    });
  } catch (error) {
    console.error("Error in analyzeUserStyle:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};
const summarizeUnread = async (req, res) => {
  try {
    const { chatName, messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "No messages provided" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.5,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 512,
      },
    });

    const stitched = messages
      .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.sender}: ${m.content}`)
      .join("\n");

    const prompt = `
You summarize unread chat messages clearly and concisely.

Conversation: ${chatName || "This chat"}
Unread messages (oldest → newest):
${stitched}

Return JSON ONLY with this schema:
{
  "summary": "3-6 tight bullets with the key points (use - for bullets)",
  "action_items": ["optional actions or questions for the user"],
  "participants_mentioned": ["names mentioned"],
  "time_range": "e.g., 10:31-10:55 or 'multiple days'"
}
`;
    console.log("summarizeUnread prompt:", prompt);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log("Gemini response text for summarizeUnread:", text);
    const json = JSON.parse(text.replace(/```json/g, "").replace(/```/g, ""));
    return res.json({ success: true, ...json });
  } catch (err) {
    console.error("summarizeUnread error:", err);
    return res.json({
      success: true,
      summary: "- You have a few unread messages.\n- Open the chat to read details.",
      action_items: [],
      participants_mentioned: [],
      time_range: "",
    });
  }
};

module.exports = {
  analyzeUserStyle,
  createOrUpdateStyleProfile,
  summarizeUnread,
};
