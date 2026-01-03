
import frappe

def item_rate_validation(doc, method):
    allow_zero = True
    settings = frappe.get_doc('Selling Settings', 'Selling Settings')
    if(doc.doctype == "POS Invocie"):
        if doc.is_pos and doc.pos_profile:
            pos_profile = frappe.get_doc('POS Profile', doc.pos_profile)
            allow_zero = True if pos_profile.allow_zero_item_rate else False
        else:
            
            allow_zero = True if settings.allow_zero_item_rate else False
    else:
        allow_zero = True if settings.allow_zero_item_rate else False


    if not allow_zero:
        errors_rows = []
        for idx, row in enumerate(doc.items, 1):
            if row.rate <= 0:
                errors_rows.append('{}'.format(idx))
        
        if len(errors_rows) > 0:
            frappe.throw("Item rate 0 not allowed in row(s) \t{}".format(",".join(errors_rows)))

def reset_discount_restrect(doc, method):
    if not doc.allow_discount_change:
        doc.restrect_discount = 0