# -*- coding: utf-8 -*-
from __future__ import unicode_literals

__version__ = '0.0.1'

import frappe

from frappe import session
from frappe.utils import flt

from erpnext.setup.doctype.authorization_control.authorization_control import AuthorizationControl

def validate_approving_authority(self, doctype_name,company, total, doc_obj = ''):
	if not frappe.db.count("Authorization Rule"):
		return

	av_dis = 0
	if doc_obj:
		price_list_rate, base_rate = 0, 0
		for d in doc_obj.get("items"):
			if d.base_rate:
				price_list_rate += flt(d.base_price_list_rate) or flt(d.base_rate)
				base_rate += flt(d.base_rate)
		if doc_obj.get("discount_amount"):
			base_rate -= flt(doc_obj.discount_amount)

		if price_list_rate: av_dis = 100 - flt(base_rate * 100 / price_list_rate)

	final_based_on = ['Grand Total','Average Discount', 'Additional Discount', 'Customerwise Discount','Itemwise Discount']

	# Check for authorization set for individual user
	based_on = [x[0] for x in frappe.db.sql("""select distinct based_on from `tabAuthorization Rule`
		where transaction = %s and system_user = %s
		and (company = %s or ifnull(company,'')='') and docstatus != 2""",
		(doctype_name, session['user'], company))]

	for d in based_on:
		self.bifurcate_based_on_type(doctype_name, total, av_dis, d, doc_obj, 1, company)

	# Remove user specific rules from global authorization rules
	for r in based_on:
		if r in final_based_on and r != 'Itemwise Discount': final_based_on.remove(r)

	# Check for authorization set on particular roles
	based_on = [x[0] for x in frappe.db.sql("""select based_on
		from `tabAuthorization Rule`
		where transaction = %s and system_role IN (%s) and based_on IN (%s)
		and (company = %s or ifnull(company,'')='')
		and docstatus != 2
	""" % ('%s', "'"+"','".join(frappe.get_roles())+"'", "'"+"','".join(final_based_on)+"'", '%s'), (doctype_name, company))]

	for d in based_on:
		self.bifurcate_based_on_type(doctype_name, total, av_dis, d, doc_obj, 2, company)

	# Remove role specific rules from global authorization rules
	for r in based_on:
		if r in final_based_on and r != 'Itemwise Discount': final_based_on.remove(r)

	# Check for global authorization
	for g in final_based_on:
		self.bifurcate_based_on_type(doctype_name, total, av_dis, g, doc_obj, 0, company)


def bifurcate_based_on_type(self, doctype_name, total, av_dis, based_on, doc_obj, val, company):
	add_cond = ''
	auth_value = av_dis

	if val == 1: add_cond += " and system_user = {}".format(frappe.db.escape(session['user']))
	elif val == 2: add_cond += " and system_role IN %s" % ("('"+"','".join(frappe.get_roles())+"')")
	else: add_cond += " and ifnull(system_user,'') = '' and ifnull(system_role,'') = ''"

	if based_on == 'Grand Total': auth_value = total
	elif based_on == 'Customerwise Discount':
		if doc_obj:
			if doc_obj.doctype == 'Sales Invoice': customer = doc_obj.customer
			else: customer = doc_obj.customer_name
			add_cond = " and master_name = {}".format(frappe.db.escape(customer))
	
	if doctype_name == 'Sales Invoice':
		if based_on == 'Additional Discount':
			base_grand_total = flt(doc_obj.get('base_total'), 4)
			base_discount = flt(doc_obj.get('base_discount_amount'), 4)
			value = flt(base_discount * 100 / base_grand_total, 4)
			auth_value = value

	if based_on == 'Itemwise Discount':
		if doc_obj:
			for t in doc_obj.get("items"):
				self.validate_auth_rule(doctype_name, t.discount_percentage, based_on, add_cond, company,t.item_code )
	else:
		self.validate_auth_rule(doctype_name, auth_value, based_on, add_cond, company)

AuthorizationControl.bifurcate_based_on_type = bifurcate_based_on_type
AuthorizationControl.validate_approving_authority = validate_approving_authority

