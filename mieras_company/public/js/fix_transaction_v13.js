frappe.provide('erpnext.accounts.dimensions');

erpnext.taxes_and_totals.prototype.is_internal_invoice = function () {
    if (['Sales Invoice', 'Purchase Invoice'].includes(this.frm.doc.doctype)) {
        if (this.frm.doc.is_internal_customer || this.frm.doc.is_internal_supplier) {
            if (this.frm.doc.company === this.frm.doc.represents_company) {
                return true;
            }
        }
    }
    return false;
}

erpnext.taxes_and_totals.prototype.calculate_outstanding_amount = function (update_paid_amount) {
    // NOTE:
    // paid_amount and write_off_amount is only for POS/Loyalty Point Redemption Invoice
    // total_advance is only for non POS Invoice
    if (in_list(["Sales Invoice", "POS Invoice"], this.frm.doc.doctype) && this.frm.doc.is_return) {
        this.calculate_paid_amount();
    }

    if (this.frm.doc.is_return || (this.frm.doc.docstatus > 0) || this.is_internal_invoice()) return;

    frappe.model.round_floats_in(this.frm.doc, ["grand_total", "total_advance", "write_off_amount"]);

    if (in_list(["Sales Invoice", "POS Invoice", "Purchase Invoice"], this.frm.doc.doctype)) {
        var grand_total = this.frm.doc.rounded_total || this.frm.doc.grand_total;

        if (this.frm.doc.party_account_currency == this.frm.doc.currency) {
            var total_amount_to_pay = flt((grand_total - this.frm.doc.total_advance
                - this.frm.doc.write_off_amount), precision("grand_total"));
        } else {
            var total_amount_to_pay = flt(
                (flt(grand_total * this.frm.doc.conversion_rate, precision("grand_total"))
                    - this.frm.doc.total_advance - this.frm.doc.base_write_off_amount),
                precision("base_grand_total")
            );
        }

        frappe.model.round_floats_in(this.frm.doc, ["paid_amount"]);
        this.set_in_company_currency(this.frm.doc, ["paid_amount"]);

        if (this.frm.refresh_field) {
            this.frm.refresh_field("paid_amount");
            this.frm.refresh_field("base_paid_amount");
        }

        if (in_list(["Sales Invoice", "POS Invoice"], this.frm.doc.doctype)) {
            let total_amount_for_payment = (this.frm.doc.redeem_loyalty_points && this.frm.doc.loyalty_amount)
                ? flt(total_amount_to_pay - this.frm.doc.loyalty_amount, precision("base_grand_total"))
                : total_amount_to_pay;
                
            this.set_default_payment(total_amount_for_payment, update_paid_amount);
            this.calculate_paid_amount();
        }
        this.calculate_change_amount();

        var paid_amount = (this.frm.doc.party_account_currency == this.frm.doc.currency) ?
            this.frm.doc.paid_amount : this.frm.doc.base_paid_amount;
        this.frm.doc.outstanding_amount = flt(total_amount_to_pay - flt(paid_amount) +
            flt(this.frm.doc.change_amount * this.frm.doc.conversion_rate), precision("outstanding_amount"));
    }
}

erpnext.TransactionController.prototype.item_code = function (doc, cdt, cdn) {
    var me = this;
    var item = frappe.get_doc(cdt, cdn);
    var update_stock = 0, show_batch_dialog = 0;
    if (['Sales Invoice'].includes(this.frm.doc.doctype)) {
        update_stock = cint(me.frm.doc.update_stock);
        show_batch_dialog = update_stock;

    } else if ((this.frm.doc.doctype === 'Purchase Receipt' && me.frm.doc.is_return) ||
        this.frm.doc.doctype === 'Delivery Note') {
        show_batch_dialog = 1;
    }
    // clear barcode if setting item (else barcode will take priority)
    if (this.frm.from_barcode == 0) {
        item.barcode = null;
    }
    this.frm.from_barcode = this.frm.from_barcode - 1 >= 0 ? this.frm.from_barcode - 1 : 0;


    if (item.item_code || item.barcode || item.serial_no) {
        if (!this.validate_company_and_party()) {
            this.frm.fields_dict["items"].grid.grid_rows[item.idx - 1].remove();
        } else {
            return this.frm.call({
                method: "erpnext.stock.get_item_details.get_item_details",
                child: item,
                args: {
                    doc: me.frm.doc,
                    args: {
                        item_code: item.item_code,
                        barcode: item.barcode,
                        serial_no: item.serial_no,
                        batch_no: item.batch_no,
                        set_warehouse: me.frm.doc.set_warehouse,
                        warehouse: item.warehouse,
                        customer: me.frm.doc.customer || me.frm.doc.party_name,
                        quotation_to: me.frm.doc.quotation_to,
                        supplier: me.frm.doc.supplier,
                        currency: me.frm.doc.currency,
                        update_stock: update_stock,
                        conversion_rate: me.frm.doc.conversion_rate,
                        price_list: me.frm.doc.selling_price_list || me.frm.doc.buying_price_list,
                        price_list_currency: me.frm.doc.price_list_currency,
                        plc_conversion_rate: me.frm.doc.plc_conversion_rate,
                        company: me.frm.doc.company,
                        order_type: me.frm.doc.order_type,
                        is_pos: cint(me.frm.doc.is_pos),
                        is_return: cint(me.frm.doc.is_return),
                        is_subcontracted: me.frm.doc.is_subcontracted,
                        transaction_date: me.frm.doc.transaction_date || me.frm.doc.posting_date,
                        ignore_pricing_rule: me.frm.doc.ignore_pricing_rule,
                        doctype: me.frm.doc.doctype,
                        name: me.frm.doc.name,
                        project: item.project || me.frm.doc.project,
                        qty: item.qty || 1,
                        net_rate: item.rate,
                        stock_qty: item.stock_qty,
                        conversion_factor: item.conversion_factor,
                        weight_per_unit: item.weight_per_unit,
                        weight_uom: item.weight_uom,
                        manufacturer: item.manufacturer,
                        stock_uom: item.stock_uom,
                        pos_profile: cint(me.frm.doc.is_pos) ? me.frm.doc.pos_profile : '',
                        cost_center: item.cost_center,
                        tax_category: me.frm.doc.tax_category,
                        item_tax_template: item.item_tax_template,
                        child_docname: item.name
                    }
                },
                callback: function (r) {
                    if (!r.exc) {
                        frappe.run_serially([
                            () => {
                                var d = locals[cdt][cdn];
                                me.add_taxes_from_item_tax_template(d.item_tax_rate);
                                if (d.free_item_data) {
                                    me.apply_product_discount(d);
                                }
                            },
                            () => {
                                // for internal customer instead of pricing rule directly apply valuation rate on item
                                if (me.frm.doc.is_internal_customer || me.frm.doc.is_internal_supplier) {
                                    me.get_incoming_rate(item, me.frm.posting_date, me.frm.posting_time,
                                        me.frm.doc.doctype, me.frm.doc.company);
                                } else {
                                    /**
                                     * Fix(1) `Target warehouse == customer warehouse` error
                                     * when user has default value for warehouse it set taht value even if the customer or suppler
                                     * is not internal
                                     */
                                    item.target_warehouse = ''
                                    item.from_warehouse = ''
                                    me.frm.script_manager.trigger("price_list_rate", cdt, cdn);
                                }
                            },
                            () => {
                                if (me.frm.doc.is_internal_customer || me.frm.doc.is_internal_supplier) {
                                    me.calculate_taxes_and_totals();
                                }
                            },
                            () => me.toggle_conversion_factor(item),
                            () => {
                                if (show_batch_dialog)
                                    return frappe.db.get_value("Item", item.item_code, ["has_batch_no", "has_serial_no"])
                                        .then((r) => {
                                            if (r.message &&
                                                (r.message.has_batch_no || r.message.has_serial_no)) {
                                                frappe.flags.hide_serial_batch_dialog = false;
                                            }
                                        });
                            },
                            () => {
                                // check if batch serial selector is disabled or not
                                if (show_batch_dialog && !frappe.flags.hide_serial_batch_dialog)
                                    return frappe.db.get_single_value('Stock Settings', 'disable_serial_no_and_batch_selector')
                                        .then((value) => {
                                            if (value) {
                                                frappe.flags.hide_serial_batch_dialog = true;
                                            }
                                        });
                            },
                            () => {
                                if (show_batch_dialog && !frappe.flags.hide_serial_batch_dialog) {
                                    var d = locals[cdt][cdn];
                                    $.each(r.message, function (k, v) {
                                        if (!d[k]) d[k] = v;
                                    });

                                    if (d.has_batch_no && d.has_serial_no) {
                                        d.batch_no = undefined;
                                    }

                                    erpnext.show_serial_batch_selector(me.frm, d, (item) => {
                                        me.frm.script_manager.trigger('qty', item.doctype, item.name);
                                        if (!me.frm.doc.set_warehouse)
                                            me.frm.script_manager.trigger('warehouse', item.doctype, item.name);
                                    }, undefined, !frappe.flags.hide_serial_batch_dialog);
                                }
                            },
                            () => me.conversion_factor(doc, cdt, cdn, true),
                            () => me.remove_pricing_rule(item),
                            () => {
                                if (item.apply_rule_on_other_items) {
                                    let key = item.name;
                                    me.apply_rule_on_other_items({ key: item });
                                }
                            },
                            () => {
                                var company_currency = me.get_company_currency();
                                me.update_item_grid_labels(company_currency);
                            },
                            () => {
                                me.calculate_outstanding_amount(true)
                            }
                        ]);
                    }
                }
            });
        }
    }
}

erpnext.TransactionController.prototype.qty = function (doc, cdt, cdn) {
    let item = frappe.get_doc(cdt, cdn);
    this.conversion_factor(doc, cdt, cdn, true);
    this.calculate_stock_uom_rate(doc, cdt, cdn);
    /**
     * Apply pricing rules to update payments
     */
    this.apply_pricing_rule(item, true);
    if (doc.is_pos) {
        this.set_default_payment()
    }
}

erpnext.TransactionController.prototype.rate = function (doc, cdt, cdn) {
    /**
     * Apply pricing rules to update payments
     */
    let item = frappe.get_doc(cdt, cdn);
    this.conversion_factor(doc, cdt, cdn, true);
    this.calculate_stock_uom_rate(doc, cdt, cdn);
    /**
     * Apply pricing rules to update payments
     */
    this.apply_pricing_rule(item, true);
    if (doc.is_pos) {
        this.set_default_payment()
    }
}
