"""Mother Brain Supervisor for Leaflet Challenge."""
from __future__ import annotations

from pathlib import Path
from typing import List
from ..protocols.messages import DiagnosticSynthesis, SpecialistResult
from ..swarm.agents import GeoJsonSpecialist, LeafletVisualizationSpecialist, WebHygieneCritic


class LeafletChallengeMotherBrain:
    """Executive supervisor arbitrating GeoJSON data, visual mapping, and web hygiene."""

    def __init__(self, project_root: Path) -> None:
        self.project_root = Path(project_root).resolve()
        self.geo_specialist = GeoJsonSpecialist(self.project_root)
        self.vis_specialist = LeafletVisualizationSpecialist(self.project_root)
        self.critic = WebHygieneCritic(self.project_root)

    def run_investigation(self) -> DiagnosticSynthesis:
        results: List[SpecialistResult] = [
            self.geo_specialist.analyze(),
            self.vis_specialist.analyze(),
            self.critic.analyze(),
        ]

        recommendations = []
        score = 1.0

        for r in results:
            if r.status == "FAILED":
                score -= 0.3
            elif r.status == "WARNING":
                score -= 0.1
            recommendations.extend(r.recommendations)

        return DiagnosticSynthesis(
            overall_health=max(0.0, min(1.0, score)),
            specialist_results=results,
            recommendations=recommendations,
        )
