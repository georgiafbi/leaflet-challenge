"""Specialist swarm agents for Leaflet Challenge."""
from __future__ import annotations

from pathlib import Path
import re
from typing import List
from ..protocols.messages import SpecialistResult


class GeoJsonSpecialist:
    """Specialist agent: Audits GeoJSON data feeds, earthquake coordinates, and depth parsing."""

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.agent_id = "geojson_specialist"
        self.role = "GeoJSON Data & Earthquake Feed Specialist"

    def analyze(self) -> SpecialistResult:
        findings: List[str] = []
        recommendations: List[str] = []
        js_files = list(self.project_root.glob("**/*.js"))

        found_usgs = False
        for jf in js_files:
            content = jf.read_text(encoding="utf-8", errors="ignore")
            if "earthquake.usgs.gov" in content or "geojson" in content.lower():
                found_usgs = True
                findings.append(f"USGS GeoJSON API endpoint or geojson reference found in '{jf.name}'.")

        if found_usgs:
            status = "PASSED"
        else:
            status = "WARNING"
            findings.append("No USGS earthquake GeoJSON endpoint found in JS scripts.")
            recommendations.append("Ensure logic.js connects to an active USGS GeoJSON summary feed.")

        return SpecialistResult(
            agent_id=self.agent_id,
            role=self.role,
            status=status,
            findings=findings,
            recommendations=recommendations,
        )


class LeafletVisualizationSpecialist:
    """Specialist agent: Audits Leaflet maps, circle markers, depth color scales, and legends."""

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.agent_id = "leaflet_vis_specialist"
        self.role = "Leaflet Mapping & Visual Styling Specialist"

    def analyze(self) -> SpecialistResult:
        findings: List[str] = []
        recommendations: List[str] = []
        html_files = list(self.project_root.glob("**/*.html"))

        has_map_div = False
        for hf in html_files:
            content = hf.read_text(encoding="utf-8", errors="ignore")
            if any(m in content for m in ('id="map"', "id='map'", 'id="map-id"', "id='map-id'")):
                has_map_div = True
                findings.append(f"Map container `<div id='map-id'>` or `<div id='map'>` verified in '{hf.name}'.")

        if has_map_div:
            status = "PASSED"
        else:
            status = "FAILED"
            findings.append("Missing `<div id='map'>` in HTML templates.")
            recommendations.append("Add `<div id='map'></div>` for Leaflet to mount.")

        return SpecialistResult(
            agent_id=self.agent_id,
            role=self.role,
            status=status,
            findings=findings,
            recommendations=recommendations,
        )


class WebHygieneCritic:
    """Adversarial critic: Audits external CDN links, stylesheet links, and script dependencies."""

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.agent_id = "web_hygiene_critic"
        self.role = "Web Hygiene & CDN Security Critic"

    def analyze(self) -> SpecialistResult:
        findings: List[str] = []
        recommendations: List[str] = []
        html_files = list(self.project_root.glob("**/*.html"))

        for hf in html_files:
            content = hf.read_text(encoding="utf-8", errors="ignore")
            if ("leaflet.js" in content and "leaflet.css" in content) or ("maplibre-gl.js" in content and "maplibre-gl.css" in content):
                findings.append(f"Map library CSS & JS CDN links verified in '{hf.name}'.")
            elif "leaflet" in content or "maplibre" in content:
                findings.append(f"Partial map library dependencies in '{hf.name}'.")
                recommendations.append("Ensure both CSS and JS map library links are included.")

            if "d3js.org" in content or "d3.v" in content or "d3" in content:
                findings.append(f"D3.js library verified in '{hf.name}'.")

        status = "PASSED" if findings else "WARNING"
        return SpecialistResult(
            agent_id=self.agent_id,
            role=self.role,
            status=status,
            findings=findings,
            recommendations=recommendations,
        )
