const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getElevenLabsSignedUrl() {
  try {
    // 1. We call OUR backend router, not ElevenLabs directly
    const response = await fetch(`${API_URL}/elevenlabs`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to get signed URL from backend");
    }

    // 2. We extract the temporary URL from your Python backend's JSON response
    const data = await response.json();
    
    if (!data.signedUrl) {
      throw new Error("Backend response did not contain a signedUrl");
    }

    return data.signedUrl; 

  } catch (error) {
    console.error("Error fetching ElevenLabs URL:", error);
    throw error;
  }
}