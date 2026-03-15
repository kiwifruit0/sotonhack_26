from ..controllers.speech_controller import call_gemini
from fastapi import APIRouter, Query
from ..controllers.daily_summary_controller import collate_summaries
from .db_router import list_interests
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.post("/categorize")
async def categorize_text(request):
    categories = list_interests
    prompt = f"""
    Analyze the following text and categorize it into EXACTLY ONE of these categories: {', '.join(categories)}.
    Return only the category name.

    Text: {request}
    """
    result = await call_gemini(prompt)
    return {"processed_text": result}


@router.post("/humanize")
async def humanize_text(text):
    prompt = f"""
    You are an API which returns ONE option.
    Rewrite the following text to sound more transitional between quotes. 
    Avoid robotic phrasing or overly formal jargon while maintaining the original user quote.

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

async def generalise_answer(text):
    prompt = f"""
    Determine the user's choice from their input.
    There are TWO options:
    Yes
    No
    Pick ONE option from the given choices.

    Input: {text}
    """
    result = await call_gemini(prompt)
    return result