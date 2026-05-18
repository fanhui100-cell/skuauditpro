# Payment automation plan

Current production flow:

1. The user chooses a plan.
2. The user pays by scanning the WeChat Pay or Alipay QR code.
3. The user includes the registered email or order number in the payment note.
4. The user submits the payment note in the account center.
5. The admin verifies the payment and marks the order as paid.
6. The system opens the matching plan quota after the paid status is confirmed.

Future automatic activation flow:

1. Apply for official WeChat Pay and Alipay merchant accounts.
2. Generate a unique order number and amount from the backend.
3. Redirect the user to an official payment page or generate a dynamic payment QR code.
4. Receive the asynchronous payment callback on the backend.
5. Verify the callback signature, order number, amount, and payment status.
6. Mark the order as paid and activate the matching plan quota automatically.
7. Store payment callback logs and admin/audit logs for refunds and support.

Do not activate paid plans from frontend redirect status alone. Automatic activation must be based on verified backend payment callbacks.
