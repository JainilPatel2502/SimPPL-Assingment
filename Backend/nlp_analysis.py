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

Context: This post discusses the "Epstein Files" (unsealed court documents linked to Jeffrey Epstein).
Background information for classification:
1. The Epstein files refer to a trove of court documents unsealed in early 2024 related to a lawsuit involving Ghislaine Maxwell.
2. The release explicitly named many high-profile associates, alleged victims, and public figures connected to Epstein's trafficking ring.
3. This unsealing sparked intense public scrutiny, widespread conspiracy theories, and renewed debates around elite accountability.
4. The dataset captures Reddit public discourse, media reports, and diverse reactions to the unveiling of these documents.

Using this context, provide a precise "narrative" classification for this specific post (e.g., Conspiracy Theory, Political Deflection, Legal Process, Media Critique, Victim Advocacy, General Information, etc.).

Return ONLY a valid JSON object with the following structure (no markdown tags, no backticks, just the raw JSON object string):
{{
  "sentiment": "Positive, Negative, or Neutral",
  "entities": ["list", "of", "entities"],
  "narrative": "A short 1-sentence classification of the overarching narrative",
  "name_calling": "Explain any target or name-calling attacks (e.g. insulting labels against an object/subject). If none, say 'None detected.'",
  "doubt_credibility": "Explain any doubt thrown, or questioning of the credibility of someone/something. If none, say 'None detected.'"
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
