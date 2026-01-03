from __future__ import unicode_literals
from frappe import _
import frappe


def get_data():
	config = [
		{
			"label": _("Profitability"),
			"items": [
				{
					"type": "report",
					"name": "Gross Profit Based On Valuation Rate",
					"doctype": "Sales Invoice",
					"is_query_report": True
				},
			]
		},
    ]
	return config
