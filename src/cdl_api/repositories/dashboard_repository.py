"""In-memory analytics dashboard repository."""

from cdl_api.contracts.dashboard import (
    ChartDataPoint,
    DashboardAggregation,
    DashboardChartType,
    DashboardDimension,
    DashboardFilter,
    DashboardFilterScope,
    DashboardMetric,
    DashboardTableColumn,
    DashboardTableRow,
    DashboardWidgetDefinition,
)
from cdl_api.contracts.domain import GameweekSummary


class DashboardRepository:
    """Repository boundary for dashboard definitions and aggregated fact results."""

    def get_gameweek(self) -> GameweekSummary:
        return GameweekSummary(id="gw-12", name="Gameweek 12", number=12)

    def list_metrics(self) -> list[DashboardMetric]:
        return [
            DashboardMetric(
                id="fantasy_points",
                label="Fantasy points",
                description="Total fantasy points from allowlisted player performance facts.",
                aggregation=DashboardAggregation.SUM,
                format="points",
            ),
            DashboardMetric(
                id="expected_points",
                label="Expected points",
                description="Expected points projection from the metric catalog.",
                aggregation=DashboardAggregation.AVG,
                format="points",
            ),
            DashboardMetric(
                id="starts",
                label="Starts",
                description="Count of player starts in the selected context.",
                aggregation=DashboardAggregation.COUNT,
                format="number",
            ),
            DashboardMetric(
                id="captaincy_share",
                label="Captaincy share",
                description="Share of lineups captaining players in the selected context.",
                aggregation=DashboardAggregation.AVG,
                format="percentage",
            ),
        ]

    def list_dimensions(self) -> list[DashboardDimension]:
        return [
            DashboardDimension(
                id="cdl_team",
                label="CDL team",
                description="Castle Draft League manager team.",
                values=["Castle FC", "Drafton", "Rival Town", "North Keep"],
            ),
            DashboardDimension(
                id="epl_team",
                label="EPL team",
                description="Premier League club represented by selected players.",
                values=["Arsenal", "Manchester City", "Liverpool", "Tottenham"],
            ),
            DashboardDimension(
                id="position",
                label="Position",
                description="Fantasy player position.",
                values=["GKP", "DEF", "MID", "FWD"],
            ),
            DashboardDimension(
                id="gameweek",
                label="Gameweek",
                description="Castle Draft League scoring gameweek.",
                values=["Gameweek 10", "Gameweek 11", "Gameweek 12"],
            ),
        ]

    def list_filters(self) -> list[DashboardFilter]:
        return [
            DashboardFilter(
                id="gameweek",
                label="Gameweek",
                dimension_id="gameweek",
                scope=DashboardFilterScope.GLOBAL,
                options=["Gameweek 10", "Gameweek 11", "Gameweek 12"],
                default_value="Gameweek 12",
            ),
            DashboardFilter(
                id="cdl_team",
                label="CDL team",
                dimension_id="cdl_team",
                scope=DashboardFilterScope.GLOBAL,
                options=["All teams", "Castle FC", "Drafton", "Rival Town", "North Keep"],
                default_value="All teams",
            ),
            DashboardFilter(
                id="position",
                label="Position",
                dimension_id="position",
                scope=DashboardFilterScope.WIDGET,
                options=["All positions", "GKP", "DEF", "MID", "FWD"],
                default_value="All positions",
            ),
        ]

    def list_widgets(self) -> list[DashboardWidgetDefinition]:
        return [
            DashboardWidgetDefinition(
                id="team-points",
                title="Points by CDL team",
                description="Total fantasy points by manager team for the selected gameweek.",
                chart_type=DashboardChartType.BAR,
                metric_id="fantasy_points",
                dimension_id="cdl_team",
                filter_ids=["gameweek", "cdl_team"],
                supports_drilldown=True,
            ),
            DashboardWidgetDefinition(
                id="position-points",
                title="Points by position",
                description="Fantasy points split across player positions.",
                chart_type=DashboardChartType.BAR,
                metric_id="fantasy_points",
                dimension_id="position",
                filter_ids=["gameweek", "position"],
                supports_drilldown=True,
            ),
            DashboardWidgetDefinition(
                id="expected-points-trend",
                title="Expected points trend",
                description="Average expected points across recent gameweeks.",
                chart_type=DashboardChartType.LINE,
                metric_id="expected_points",
                dimension_id="gameweek",
                filter_ids=["cdl_team"],
                sort="asc",
            ),
            DashboardWidgetDefinition(
                id="captaincy-table",
                title="Captaincy table",
                description="Captaincy share by CDL team.",
                chart_type=DashboardChartType.TABLE,
                metric_id="captaincy_share",
                dimension_id="cdl_team",
                filter_ids=["gameweek"],
                supports_drilldown=True,
            ),
        ]

    def aggregate_widget(
        self,
        widget: DashboardWidgetDefinition,
        filters: dict[str, str],
    ) -> list[ChartDataPoint]:
        data = {
            "team-points": [
                ("Castle FC", 74, "castle"),
                ("Drafton", 66, "drafton"),
                ("Rival Town", 62, "rival-town"),
                ("North Keep", 58, "north-keep"),
            ],
            "position-points": [
                ("MID", 118, "mid"),
                ("FWD", 92, "fwd"),
                ("DEF", 74, "def"),
                ("GKP", 28, "gkp"),
            ],
            "expected-points-trend": [
                ("Gameweek 10", 54.2, "gw-10"),
                ("Gameweek 11", 59.8, "gw-11"),
                ("Gameweek 12", 63.4, "gw-12"),
            ],
            "captaincy-table": [
                ("Castle FC", 0.32, "castle"),
                ("Drafton", 0.28, "drafton"),
                ("Rival Town", 0.23, "rival-town"),
                ("North Keep", 0.17, "north-keep"),
            ],
        }[widget.id]

        selected_team = filters.get("cdl_team")
        selected_position = filters.get("position")
        if selected_team and selected_team != "All teams" and widget.dimension_id == "cdl_team":
            data = [point for point in data if point[0] == selected_team]
        if (
            selected_position
            and selected_position != "All positions"
            and widget.dimension_id == "position"
        ):
            data = [point for point in data if point[0] == selected_position]

        return [
            ChartDataPoint(label=label, value=value, dimension_value=label, drilldown_key=key)
            for label, value, key in data
        ]

    def list_table_columns(self, widget: DashboardWidgetDefinition) -> list[DashboardTableColumn]:
        return [
            DashboardTableColumn(
                id=widget.dimension_id,
                label=widget.title.replace(" table", ""),
            ),
            DashboardTableColumn(
                id=widget.metric_id,
                label=widget.metric_id.replace("_", " ").title(),
                align="right",
            ),
        ]

    def list_table_rows(
        self,
        widget: DashboardWidgetDefinition,
        points: list[ChartDataPoint],
    ) -> list[DashboardTableRow]:
        return [
            DashboardTableRow(
                cells={widget.dimension_id: point.label, widget.metric_id: point.value}
            )
            for point in points
        ]

    def drilldown_rows(
        self,
        widget: DashboardWidgetDefinition,
        point_key: str,
    ) -> list[DashboardTableRow]:
        fallback_rows = [
            {"player": "Sample Player", "team": "Sample Team", "points": 6},
        ]
        detail_rows = {
            "castle": [
                {"player": "Casey Midfielder", "team": "Castle FC", "points": 14},
                {"player": "Alex Keeper", "team": "Castle FC", "points": 9},
            ],
            "drafton": [
                {"player": "Riley Forward", "team": "Drafton", "points": 12},
                {"player": "Morgan Defender", "team": "Drafton", "points": 8},
            ],
            "mid": [
                {"player": "Casey Midfielder", "team": "Castle FC", "points": 14},
                {"player": "Taylor Creator", "team": "Rival Town", "points": 11},
            ],
            "fwd": [
                {"player": "Riley Forward", "team": "Drafton", "points": 12},
                {"player": "Jordan Striker", "team": "North Keep", "points": 10},
            ],
        }.get(point_key, fallback_rows)
        return [DashboardTableRow(cells=row) for row in detail_rows]
