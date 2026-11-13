import { SendEmailCommand, type SESv2Client } from "@aws-sdk/client-sesv2";
import { PublishCommand, type SNSClient } from "@aws-sdk/client-sns";
import type { Env } from "../../config/env.js";
import { MessageSender, type OutboundMessage } from "./message-sender.js";
import type { TemplateService } from "./template.service.js";

/**
 * Sends real messages through AWS:
 *   - email with Amazon SES
 *   - SMS with Amazon SNS (marked "Transactional", the class meant for one-time codes)
 *
 * Both are billed per message, with no monthly fee, which suits a small site.
 *
 * Things to arrange outside the code before it works for real users:
 *   - SES: verify the sender address or domain, and ask AWS to move the account out
 *     of the SES "sandbox" (in the sandbox only verified addresses can receive mail).
 *   - SNS SMS: raise the monthly SMS spending limit (it starts at 1 US dollar).
 *   - SMS to Indian numbers: register on a DLT portal and put the entity id and the
 *     template ids in the settings. Without them operators block the SMS.
 */
export class AwsMessageSender extends MessageSender {
  constructor(
    private readonly env: Env,
    private readonly templates: TemplateService,
    private readonly ses: Pick<SESv2Client, "send">,
    private readonly sns: Pick<SNSClient, "send">,
  ) {
    super();
  }

  async send(message: OutboundMessage): Promise<void> {
    const rendered = await this.templates.render(message.template, message.channel, message.variables);

    if (message.channel === "email") {
      await this.ses.send(
        new SendEmailCommand({
          FromEmailAddress: this.env.MAIL_FROM,
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: rendered.subject ?? this.env.BRAND_NAME, Charset: "UTF-8" },
              Body: { Text: { Data: rendered.text, Charset: "UTF-8" } },
            },
          },
        }),
      );
      return;
    }

    const attribute = (value: string) => ({ DataType: "String", StringValue: value });
    // The DLT template id of this wording: from the template row, or from the setting for one-time codes.
    const dltTemplateId = rendered.externalTemplateId ?? (message.template === "otp" ? this.env.SMS_DLT_TEMPLATE_ID_OTP : undefined);
    await this.sns.send(
      new PublishCommand({
        PhoneNumber: message.to,
        Message: rendered.text,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": attribute("Transactional"),
          ...(this.env.SMS_SENDER_ID ? { "AWS.SNS.SMS.SenderID": attribute(this.env.SMS_SENDER_ID) } : {}),
          ...(this.env.SMS_DLT_ENTITY_ID ? { "AWS.MM.SMS.EntityId": attribute(this.env.SMS_DLT_ENTITY_ID) } : {}),
          ...(dltTemplateId ? { "AWS.MM.SMS.TemplateId": attribute(dltTemplateId) } : {}),
        },
      }),
    );
  }
}
