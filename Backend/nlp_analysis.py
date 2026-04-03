import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

def extract_post_insights(title: str, content: str, api_key: str) -> dict:
    if not api_key:
        return {
            "sentiment": "Error: API Key Missing",
            "entities": [],
            "narrative_classification": "Error: API Key Missing"
        }
        
    prompt = f"""You are an advanced NLP system. Analyze the following Reddit post and extract insights.
Return ONLY a valid JSON object with the following structure (no markdown tags, no backticks, just the raw JSON object string):
{{
  "sentiment": "Positive, Negative, or Neutral",
  "entities": ["list", "of", "entities"],
  "narrative": "A short 1-sentence classification of the overarching narrative"
}}

Post Title: {title}
Post Content: {content}
"""
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=api_key,
            temperature=0,
            model_kwargs={"response_format": {"type": "json_object"}}
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        
        text = response.content.strip()
        data = json.loads(text)
        return dict(data)
    except Exception as e:
        print(f"Error during NLP analysis: {e}")
        return {
            "sentiment": "Analysis Failed",
            "entities": [],
            "narrative": f"Could not classify: {str(e)}"
        }
