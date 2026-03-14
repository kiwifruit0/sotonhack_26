from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/")
async def transcribe_audio(audio: UploadFile = File(...)):
    contents = await audio.read()
    # Replace with your STT call
    transcription = your_stt_function(contents)
    return { "transcription": transcription }