from app.main import score_lead


def test_score_is_explainable_and_rewards_decision_maker_data():
    result = score_lead(
        {
            "companyName": "Northstar",
            "email": "jordan@northstar.example",
            "website": "https://northstar.example",
            "contactName": "Jordan Lee",
            "jobTitle": "VP of Engineering",
            "industry": "Software",
            "companySize": "100-500",
            "description": "Builds developer tools",
            "sourceUrl": "https://research.example/northstar",
            "technologies": ["Python", "PostgreSQL"],
        }
    )

    assert result["score"] == 100
    assert result["qualification"] == "HIGH_PRIORITY"
    assert any("decision-maker" in reason for reason in result["reasons"])


def test_score_handles_incomplete_leads_without_inventing_qualifications():
    result = score_lead({"companyName": "Northstar"})

    assert result == {
        "score": 10,
        "reasons": ["+10: Company name is present"],
        "qualification": "LOW",
    }
