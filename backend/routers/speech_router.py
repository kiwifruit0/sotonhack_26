from ..controllers.speech_controller import call_gemini
from fastapi import APIRouter, Query
from ..controllers.daily_summary_controller import collate_summaries
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.post("/categorize")
async def categorize_text(request):
    categories = ""
    prompt = f"""
    Analyze the following text and categorize it into EXACTLY ONE of these categories: {', '.join("")}.
    Return only the category name.

    Text: {request}
    """
    result = await call_gemini(prompt)
    return {"processed_text": result}


@router.post("/humanize")
async def humanize_text(text):
    prompt = f"""
    Rewrite the following text to sound more natural and conversational. 
    Avoid robotic phrasing or overly formal jargon while maintaining the original content.

    Input: {text}
    """
    result = await call_gemini(prompt)
    return result


@router.post("/summary/daily")
async def daily_summary(username: str = Query(...)):
    buf = await collate_summaries(username)
    return StreamingResponse(
        buf,
        media_type="audio/ogg",
    )