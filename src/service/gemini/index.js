// --- Gemini API Caller ---
export const callGeminiAPI = async (payload, setNotification) => {
  try {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Key not found.");
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(
        errorBody?.error?.message ||
          `API call failed with status: ${response.status}`
      );
    }
    const result = await response.json();
    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content.parts[0].text
    ) {
      return result.candidates[0].content.parts[0].text;
    } else {
      const finishReason = result.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY")
        throw new Error("AI analysis failed due to safety settings.");
      throw new Error("AI returned an empty response.");
    }
  } catch (error) {
    setNotification({ text: `AI Error: ${error.message}`, type: "error" });
    return null;
  }
};

// --- Smart OCR Parsing with Gemini ---
export const parseInvoiceWithGemini = async (imageData, setNotification) => {
  const prompt = `You are an expert receipt parser. Analyze the following receipt image and extract the information into the specified JSON format.
    - shortDescription: A 2-3 line summary of the purchase, including key items or the purpose of the expense.
    - vendorName: If the name is unclear, infer a type like "Restaurant" or "Gas Station".
    - totalAmount: The FINAL amount paid, after all discounts and taxes.
    - currency: Infer the 3-letter currency code (e.g., USD, INR). Default to USD if unsure.
    - invoiceDate: Default to today's date (${
      new Date().toISOString().split("T")[0]
    }) if not found.
    - lineItems: For each item, find the final price paid, considering any discounts applied to that specific item.
    `;

  const schema = {
    type: "OBJECT",
    properties: {
      vendorName: { type: "STRING" },
      shortDescription: { type: "STRING" },
      totalAmount: { type: "NUMBER" },
      invoiceDate: { type: "STRING", description: "Date in YYYY-MM-DD format" },
      currency: {
        type: "STRING",
        description: "3-letter currency code like USD, EUR, INR",
      },
      category: {
        type: "STRING",
        enum: [
          "Food & Dining",
          "Transportation",
          "Shopping",
          "Utilities",
          "Healthcare",
          "Entertainment",
          "Other",
        ],
      },
      lineItems: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING" },
            quantity: { type: "NUMBER" },
            price: { type: "NUMBER" },
          },
          required: ["description", "price"],
        },
      },
    },
    required: [
      "vendorName",
      "totalAmount",
      "invoiceDate",
      "category",
      "shortDescription",
    ],
  };

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageData } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  const result = await callGeminiAPI(payload, setNotification);
  if (!result) return null;
  try {
    return JSON.parse(result);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", e, result);
    return null;
  }
};
