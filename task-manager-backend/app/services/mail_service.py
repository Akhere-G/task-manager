import os

from mailersend import EmailBuilder, MailerSendClient  # type: ignore


def send_email(*, sender_name, to, subject, html, reply_to=None):
    builder = (
        EmailBuilder()
        .from_email(os.getenv("MAIL_SEND_EMAIL"), sender_name)
        .to_many([{"email": to[0], "name": to[1]}])
        .subject(subject)
        .html(html)
    )
    if reply_to:
        builder = builder.reply_to(*reply_to)
    MailerSendClient(os.getenv("MAIL_SEND_API_KEY")).emails.send(builder.build())
