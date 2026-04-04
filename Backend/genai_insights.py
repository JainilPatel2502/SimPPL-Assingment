from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

def generate_timeline_summary(timeline_data: list, api_key: str, topic="this topic") -> str:
    if not api_key:
        return "Error: API Key Missing. Cannot generate summary."
        
    if not timeline_data or len(timeline_data) == 0:
        return "Not enough data to analyze the timeline."

    # Format the data into a readable string for the LLM
    data_str = "\n".join([f"{row['date']}: {row['count']} posts" for row in timeline_data])
    
    prompt = f"""You are an expert social media data analyst. Analyze the following daily post counts for a Reddit dataset discussing {topic}.
Data:
{data_str}

In exactly 1 concise journalistic paragraph (max 3-4 sentences), describe:
1. When the major activity spikes occurred
2. The peak volume day
3. Whether the narrative is growing, decaying, or showing sustained activity.
Do not use markdown formatting like bold or italics, just return plain text. Do not mention the exact word "data" or "array", speak about the "activity" or "narrative"."""

    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=api_key,
            temperature=0
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
        
    except Exception as e:
        print(f"Error during timeline AI summarization: {e}")
        return f"Could not generate summary: {str(e)}"
