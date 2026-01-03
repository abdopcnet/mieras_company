# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version

app_name = "mieras_company"
app_title = "Mieras Company"
app_publisher = "tahir-zaqout"
app_description = "Mieras"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "zaqout2000@gmail.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/mieras_company/css/mieras_company.css"
app_include_js = "/assets/mieras_company/js/fix-selling-controller.min.js"

# include js, css files in header of web template
# web_include_css = "/assets/mieras_company/css/mieras_company.css"
# web_include_js = "/assets/mieras_company/js/mieras_company.js"

# include js in page
# page_js = {"point-of-sale" : "public/js/fix-point-of-sale.min.js"}
page_js = {"point-of-sale" : "public/js/pos.js"}
# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Website user home page (by function)
# get_website_user_home_page = "mieras_company.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "mieras_company.install.before_install"
# after_install = "mieras_company.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "mieras_company.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}
# }
doc_events = {
    "Sales Invoice": {
        "validate": "mieras_company.api.item_rate_validation"
    },

    "Sales Order":{
        "validate": "mieras_company.api.item_rate_validation"
    },
    "Delivery Note":{
        "validate": "mieras_company.api.item_rate_validation"
    },
    "Quotation":{
        "validate": "mieras_company.api.item_rate_validation"
    },
    "POS Invoice": {
        "validate": "mieras_company.api.item_rate_validation"
    },
    "POS Profile": {
        "validate": "mieras_company.api.reset_discount_restrect"
    }
}
# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"mieras_company.tasks.all"
# 	],
# 	"daily": [
# 		"mieras_company.tasks.daily"
# 	],
# 	"hourly": [
# 		"mieras_company.tasks.hourly"
# 	],
# 	"weekly": [
# 		"mieras_company.tasks.weekly"
# 	]
# 	"monthly": [
# 		"mieras_company.tasks.monthly"
# 	]
# }

# Testing
# -------

# before_tests = "mieras_company.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "mieras_company.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "mieras_company.task.get_dashboard_data"
# }
