const apiKey = import.meta.env.VITE_GEMINI_API_KEY
const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash'

export async function summarizeContent(content) {
  if (!apiKey) {
    return 'Gemini API key is missing. Add VITE_GEMINI_API_KEY to .env and restart the dev server.'
  }

  const trimmed = content?.trim()
  if (!trimmed) {
    return 'Select or write some content before requesting a summary.'
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Summarize this as 4-6 concise bullet points for a note-taking app. Keep it practical and specific:\n\n${trimmed}`,
                },
              ],
            },
          ],
        }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      console.warn('Gemini request failed', error)
      return 'Gemini could not summarize this content. Check the API key, model, or browser console.'
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Gemini returned an empty summary.'
  } catch (error) {
    console.warn('Gemini request crashed', error)
    return 'Gemini request failed. Check network access and API configuration.'
  }
}
