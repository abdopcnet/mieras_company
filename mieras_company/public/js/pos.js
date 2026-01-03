frappe.pages['point-of-sale'].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Point of Sale'),
        single_column: true
    });

    frappe.require('assets/js/point-of-sale.min.js', function () {

        erpnext.PointOfSale.ItemDetails.prototype.bind_custom_control_change_event = function () {
            const me = this;
            const { maximum_discount_per_item, restrict_discount, allow_zero_item_rate } = this.events.get_pos_settings()

            if (this.rate_control) {
                this.rate_control.df.onchange = function () {
                    let check_by_zero_rate = false
                    if (this.value || flt(this.value) === 0) {
                        const item_row = frappe.get_doc(me.doctype, me.name);
                        if (!allow_zero_item_rate) {
                            const discount_val = 100 - (flt(this.value) * 100 / flt(item_row.price_list_rate))
                            if (discount_val >= 100) {
                                me.discount_percentage_control.set_value(0)
                                this.value = flt(item_row.price_list_rate)
                                me.rate_control.set_value(this.value)
                                frappe.show_alert({
                                    message: __(`Item Discount not allowed`),
                                    indicator: 'orange'
                                });
                                check_by_zero_rate = true
                            }
                        }
                        if (!check_by_zero_rate && restrict_discount) {
                            // const item_row = frappe.get_doc(me.doctype, me.name);
                            if (flt(item_row.price_list_rate) != 0) {
                                const discount_val = 100 - (flt(this.value) * 100 / flt(item_row.price_list_rate))
                                if (discount_val > flt(maximum_discount_per_item)) {
                                    const allow_disc = 100 - flt(maximum_discount_per_item)
                                    this.value = flt(item_row.price_list_rate) * flt(allow_disc) / 100
                                    me.discount_percentage_control.set_value(maximum_discount_per_item)
                                    me.rate_control.set_value(this.value)
                                    frappe.show_alert({
                                        message: __(`Item Discount Can not be greater than ${maximum_discount_per_item}%`),
                                        indicator: 'orange'
                                    });
                                }
                            }
                        }
                        me.events.form_updated(me.current_item, 'rate', this.value).then(() => {
                            const item_row = frappe.get_doc(me.doctype, me.name);
                            const doc = me.events.get_frm().doc;
                            me.$item_price.html(format_currency(item_row.rate, doc.currency));
                            me.render_discount_dom(item_row);
                        });
                    }
                };
                this.rate_control.df.read_only = !this.allow_rate_change;
                this.rate_control.refresh();
            }

            if (this.discount_percentage_control && !this.allow_discount_change) {
                this.discount_percentage_control.df.read_only = 1;
                this.discount_percentage_control.refresh();
            }

            if (this.warehouse_control) {
                this.warehouse_control.df.reqd = 1;
                this.warehouse_control.df.onchange = function () {
                    if (this.value) {
                        me.events.form_updated(me.current_item, 'warehouse', this.value).then(() => {
                            me.item_stock_map = me.events.get_item_stock_map();
                            // const available_qty = me.item_stock_map[me.item_row.item_code] && me.item_stock_map[me.item_row.item_code][this.value];
                            const available_qty = me.item_stock_map[me.item_row.item_code][this.value];
                            if (available_qty === undefined) {
                                me.events.get_available_stock(me.item_row.item_code, this.value).then(() => {
                                    // item stock map is updated now reset warehouse
                                    me.warehouse_control.set_value(this.value);
                                })
                            } else if (available_qty === 0) {
                                me.warehouse_control.set_value('');
                                const bold_item_code = me.item_row.item_code.bold();
                                const bold_warehouse = this.value.bold();
                                frappe.throw(
                                    __('Item Code: {0} is not available under warehouse {1}.', [bold_item_code, bold_warehouse])
                                );
                            }
                            me.actual_qty_control.set_value(available_qty);
                        });
                    }
                    frm.refresh_fields()
                }
                this.warehouse_control.df.get_query = () => {
                    return {
                        filters: { company: this.events.get_frm().doc.company }
                    }
                };
                this.warehouse_control.refresh();
            }

            if (this.serial_no_control) {
                this.serial_no_control.df.reqd = 1;
                this.serial_no_control.df.onchange = async function () {
                    !me.current_item.batch_no && await me.auto_update_batch_no();
                    me.events.form_updated(me.current_item, 'serial_no', this.value);
                }
                this.serial_no_control.refresh();
            }

            if (this.batch_no_control) {
                this.batch_no_control.df.reqd = 1;
                this.batch_no_control.df.get_query = () => {
                    return {
                        query: 'erpnext.controllers.queries.get_batch_no',
                        filters: {
                            item_code: me.item_row.item_code,
                            warehouse: me.item_row.warehouse,
                            posting_date: me.events.get_frm().doc.posting_date
                        }
                    }
                };
                this.batch_no_control.refresh();
            }

            if (this.uom_control) {
                this.uom_control.df.onchange = function () {
                    me.events.form_updated(me.current_item, 'uom', this.value);

                    const item_row = frappe.get_doc(me.doctype, me.name);
                    me.conversion_factor_control.df.read_only = (item_row.stock_uom == this.value);
                    me.conversion_factor_control.refresh();
                }
            }

            frappe.model.on("POS Invoice Item", "*", (fieldname, value, item_row) => {
                const field_control = this[`${fieldname}_control`];
                const item_row_is_being_edited = this.compare_with_current_item(item_row);

                if (item_row_is_being_edited && field_control && field_control.get_value() !== value) {
                    field_control.set_value(value);
                    cur_pos.update_cart_html(item_row);
                }
            });
        }

        erpnext.PointOfSale.ItemCart.prototype.show_discount_control = function () {

            const { maximum_discount_per_invocie, restrict_discount } = this.events.get_pos_settings()

            this.$add_discount_elem.css({ 'padding': '0px', 'border': 'none' });
            this.$add_discount_elem.html(
                `<div class="add-discount-field"></div>`
            );
            const me = this;
            const frm = me.events.get_frm();
            let discount = frm.doc.additional_discount_percentage;

            this.discount_field = frappe.ui.form.make_control({
                df: {
                    label: __('Discount'),
                    fieldtype: 'Data',
                    placeholder: (discount ? discount + '%' : __('Enter discount percentage.')),
                    input_class: 'input-xs',
                    onchange: function () {
                        if (flt(this.value) != 0) {
                            let value = flt(this.value)
                            if (restrict_discount) {
                                if (flt(value) > flt(maximum_discount_per_invocie)) {
                                    value = flt(maximum_discount_per_invocie)
                                    frappe.show_alert({
                                        message: __(`Additional Discount Can not be greater than ${maximum_discount_per_invocie}%`),
                                        indicator: 'orange'
                                    });
                                    // frappe.utils.play_sound("error");
                                }
                            }
                            frappe.model.set_value(frm.doc.doctype, frm.doc.name, 'additional_discount_percentage', flt(value));
                            me.hide_discount_control(`${value}`);
                        } else {
                            frappe.model.set_value(frm.doc.doctype, frm.doc.name, 'additional_discount_percentage', 0);
                            me.$add_discount_elem.css({
                                'border': '1px dashed var(--gray-500)',
                                'padding': 'var(--padding-sm) var(--padding-md)'
                            });
                            me.$add_discount_elem.html(`${me.get_discount_icon()} Add Discount`);
                            me.discount_field = undefined;
                        }
                    },
                },
                parent: this.$add_discount_elem.find('.add-discount-field'),
                render_input: true,
            });
            this.discount_field.toggle_label(false);
            this.discount_field.set_focus();
        }

        erpnext.PointOfSale.ItemCart.prototype.load_invoice = function () {
            const frm = this.events.get_frm();

            this.fetch_customer_details(frm.doc.customer).then(() => {
                this.events.customer_details_updated(this.customer_info);
                this.update_customer_section();
            });

            // this.attach_refresh_field_event(frm);

            this.$cart_items_wrapper.html('');
            if (frm.doc.items.length) {
                frm.doc.items.forEach(item => {
                    this.update_item_html(item);
                });
            } else {
                this.make_no_items_placeholder();
                this.highlight_checkout_btn(false);
            }

            this.update_totals_section(frm);

            if (frm.doc.docstatus === 1) {
                this.$totals_section.find('.checkout-btn').css('display', 'none');
                this.$totals_section.find('.edit-cart-btn').css('display', 'none');
            } else {
                this.$totals_section.find('.checkout-btn').css('display', 'flex');
                this.$totals_section.find('.edit-cart-btn').css('display', 'none');
            }

            this.toggle_component(true);
        }
        erpnext.PointOfSale.Payment.prototype.bind_events = function () {
            const me = this;

            this.$payment_modes.on('click', '.mode-of-payment', function (e) {
                const mode_clicked = $(this);
                // if clicked element doesn't have .mode-of-payment class then return
                if (!$(e.target).is(mode_clicked)) return;

                const scrollLeft = mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
                me.$payment_modes.animate({ scrollLeft });

                const mode = mode_clicked.attr('data-mode');

                // hide all control fields and shortcuts
                $(`.mode-of-payment-control`).css('display', 'none');
                $(`.cash-shortcuts`).css('display', 'none');
                me.$payment_modes.find(`.pay-amount`).css('display', 'inline');
                me.$payment_modes.find(`.loyalty-amount-name`).css('display', 'none');

                // remove highlight from all mode-of-payments
                $('.mode-of-payment').removeClass('border-primary');

                if (mode_clicked.hasClass('border-primary')) {
                    // clicked one is selected then unselect it
                    mode_clicked.removeClass('border-primary');
                    me.selected_mode = '';
                } else {
                    // clicked one is not selected then select it
                    mode_clicked.addClass('border-primary');
                    mode_clicked.find('.mode-of-payment-control').css('display', 'flex');
                    mode_clicked.find('.cash-shortcuts').css('display', 'grid');
                    me.$payment_modes.find(`.${mode}-amount`).css('display', 'none');
                    me.$payment_modes.find(`.${mode}-name`).css('display', 'inline');

                    me.selected_mode = me[`${mode}_control`];
                    me.selected_mode && me.selected_mode.$input.get(0).focus();
                    me.auto_set_remaining_amount();
                }
            });

            frappe.ui.form.on('POS Invoice', 'contact_mobile', (frm) => {
                // const contact = frm.doc.contact_mobile;
                // const request_button = $(this.request_for_payment_field.$input[0]);
                // if (contact) {
                //     request_button.removeClass('btn-default').addClass('btn-primary');
                // } else {
                //     request_button.removeClass('btn-primary').addClass('btn-default');
                // }
            });

            this.setup_listener_for_payments();

            this.$payment_modes.on('click', '.shortcut', function () {
                const value = $(this).attr('data-value');
                me.selected_mode.set_value(value);
            });

            this.$component.on('click', '.submit-order-btn', () => {
                const doc = this.events.get_frm().doc;
                const paid_amount = doc.paid_amount;
                const items = doc.items;

                if (paid_amount == 0 || !items.length) {
                    const message = items.length ? __("You cannot submit the order without payment.") : __("You cannot submit empty order.");
                    frappe.show_alert({ message, indicator: "orange" });
                    frappe.utils.play_sound("error");
                    return;
                }

                this.events.submit_invoice();
            });

            frappe.ui.form.on('POS Invoice', 'paid_amount', (frm) => {
                this.update_totals_section(frm.doc);

                // need to re calculate cash shortcuts after discount is applied
                const is_cash_shortcuts_invisible = !this.$payment_modes.find('.cash-shortcuts').is(':visible');
                this.attach_cash_shortcuts(frm.doc);
                !is_cash_shortcuts_invisible && this.$payment_modes.find('.cash-shortcuts').css('display', 'grid');
                this.render_payment_mode_dom();
            });

            frappe.ui.form.on('POS Invoice', 'loyalty_amount', (frm) => {
                const formatted_currency = format_currency(frm.doc.loyalty_amount, frm.doc.currency);
                this.$payment_modes.find(`.loyalty-amount-amount`).html(formatted_currency);
            });

            frappe.ui.form.on("Sales Invoice Payment", "amount", (frm, cdt, cdn) => {
                // for setting correct amount after loyalty points are redeemed
                const default_mop = locals[cdt][cdn];
                const mode = default_mop.mode_of_payment.replace(/ +/g, "_").toLowerCase();
                if (this[`${mode}_control`] && this[`${mode}_control`].get_value() != default_mop.amount) {
                    this[`${mode}_control`].set_value(default_mop.amount);
                }
            });
        }

        erpnext.PointOfSale.Controller.prototype.get_item_from_frm = function ({ name, item_code, batch_no, uom, rate }) {
            let item_row = null;
            if (name) {
                item_row = this.frm.doc.items.find(i => i.name == name);
            } else {
                // if item is clicked twice from item selector
                // then "item_code, batch_no, uom, rate" will help in getting the exact item
                // to increase the qty by one
                const has_batch_no = batch_no;
                item_row = this.frm.doc.items.find(
                    i => i.item_code === item_code
                        && (!has_batch_no || (has_batch_no && i.batch_no === batch_no))
                        && (i.uom === uom)
                        && (flt(i.rate) == flt(rate))
                );
            }

            return item_row || {};
        }

        erpnext.PointOfSale.Controller.prototype.check_stock_availability = async function (item_row, qty_needed, warehouse) {
            const available_qty = (await this.get_available_stock(item_row.item_code, warehouse)).message;
            // frappe.dom.unfreeze();
            const bold_item_code = item_row.item_code.bold();
            const bold_warehouse = warehouse.bold();
            const bold_available_qty = available_qty.toString().bold()
            if (!(available_qty > 0)) {
                frappe.model.clear_doc(item_row.doctype, item_row.name);
                frappe.throw({
                    title: __("Not Available"),
                    message: __('Item Code: {0} is not available under warehouse {1}.', [bold_item_code, bold_warehouse])
                })
            } else if (available_qty < qty_needed) {
                frappe.show_alert({
                    message: __('Stock quantity not enough for Item Code: {0} under warehouse {1}. Available quantity {2}.', [bold_item_code, bold_warehouse, bold_available_qty]),
                    indicator: 'orange'
                });
                frappe.utils.play_sound("error");
            } else {
                return
            }
            frappe.dom.freeze();
        }

        erpnext.PointOfSale.Controller.prototype.init_item_details = function () {
            this.item_details = new erpnext.PointOfSale.ItemDetails({
                wrapper: this.$components_wrapper,
                settings: this.settings,
                events: {
                    get_frm: () => this.frm,
                    get_pos_settings: () => this.settings,
                    toggle_item_selector: (minimize) => {
                        this.item_selector.resize_selector(minimize);
                        this.cart.toggle_numpad(minimize);
                    },

                    form_updated: (item, field, value) => {
                        const item_row = frappe.model.get_doc(item.doctype, item.name);
                        if (item_row && item_row[field] != value) {
                            const args = {
                                field,
                                value,
                                item: this.item_details.current_item
                            };
                            return this.on_cart_update(args);
                        }

                        return Promise.resolve();
                    },

                    highlight_cart_item: (item) => {
                        const cart_item = this.cart.get_cart_item(item);
                        this.cart.toggle_item_highlight(cart_item);
                    },

                    item_field_focused: (fieldname) => {
                        this.cart.toggle_numpad_field_edit(fieldname);
                    },
                    set_value_in_current_cart_item: (selector, value) => {
                        this.cart.update_selector_value_in_cart_item(selector, value, this.item_details.current_item);
                    },
                    clone_new_batch_item_in_frm: (batch_serial_map, item) => {
                        // called if serial nos are 'auto_selected' and if those serial nos belongs to multiple batches
                        // for each unique batch new item row is added in the form & cart
                        Object.keys(batch_serial_map).forEach(batch => {
                            const item_to_clone = this.frm.doc.items.find(i => i.name == item.name);
                            const new_row = this.frm.add_child("items", { ...item_to_clone });
                            // update new serialno and batch
                            new_row.batch_no = batch;
                            new_row.serial_no = batch_serial_map[batch].join(`\n`);
                            new_row.qty = batch_serial_map[batch].length;
                            this.frm.doc.items.forEach(row => {
                                if (item.item_code === row.item_code) {
                                    this.update_cart_html(row);
                                }
                            });
                        })
                    },
                    remove_item_from_cart: () => this.remove_item_from_cart(),
                    get_item_stock_map: () => this.item_stock_map,
                    close_item_details: () => {
                        this.item_details.toggle_item_details_section(null);
                        this.cart.prev_action = null;
                        this.cart.toggle_item_highlight();
                    },
                    get_available_stock: (item_code, warehouse) => this.get_available_stock(item_code, warehouse)
                }
            });
        }

        erpnext.PointOfSale.Controller.prototype.init_item_cart = function () {
            this.cart = new erpnext.PointOfSale.ItemCart({
                wrapper: this.$components_wrapper,
                settings: this.settings,
                events: {
                    get_frm: () => this.frm,
                    get_pos_settings: () => this.settings,
                    cart_item_clicked: (item) => {
                        const item_row = this.get_item_from_frm(item);
                        this.item_details.toggle_item_details_section(item_row);
                    },

                    numpad_event: (value, action) => this.update_item_field(value, action),

                    checkout: () => this.payment.checkout(),

                    edit_cart: () => this.payment.edit_cart(),

                    customer_details_updated: (details) => {
                        this.customer_details = details;
                        // will add/remove LP payment method
                        this.payment.render_loyalty_points_payment_mode();
                    }
                }
            })
        }

        wrapper.pos = new erpnext.PointOfSale.Controller(wrapper);
        window.cur_pos = wrapper.pos;
    });
};
