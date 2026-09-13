"""Data contracts for Leaflet Challenge Swarm."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class SpecialistResult:
    agent_id: str
    role: str
    status: str
    findings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class DiagnosticSynthesis:
    overall_health: float
    specialist_results: List[SpecialistResult]
    recommendations: List[str]
