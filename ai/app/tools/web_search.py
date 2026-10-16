import requests

SEARXNG_URL = (
    "https://hexawave-free-search.onrender.com/search"
)


def web_search(query: str, limit: int = 5) -> list:
    """Search the web using the SearXNG instance."""
    try:
        response = requests.get(
            SEARXNG_URL,
            params={
                "q": query,
                "format": "json",
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()

        return [
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("content", ""),
            }
            for item in data.get("results", [])[:limit]
        ]

    except requests.RequestException as exc:
        return [{"error": f"Search request failed: {exc}"}]
    except ValueError:
        return [{"error": "SearXNG did not return valid JSON."}]
