module.exports = function(RED) {

    const { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } = require("@aws-sdk/client-sqs");
    const mustache = require('mustache');

    const deleteMessage = async (client, sqsUrl, entries) => {
        const command = new DeleteMessageBatchCommand({
            QueueUrl: sqsUrl,
            Entries: entries
        });

        try {
             await client.send(command);
        } catch (e) {
            console.error('cant delete message', e, messages);
        }
    };

    function SQSReadMessage(props) {
        RED.nodes.createNode(this, props);

        const awsConfig = RED.nodes.getNode(props.aws);

        this.name = props.name;
        this.deleteAfterRead = props.deleteAfterRead;
        this.retries = props.retries || 5;

        this.sqsUrl = props.sqsUrl;
        this.visibilityTimeout = props.visibilityTimeout || 10;
        this.waitTimeSeconds = props.waitTimeSeconds || 10;
        this.requestAttemptId = props.requestAttemptId || '';
        this.maxMessage = props.maxMessage;

        const node = this;

        const client = new SQSClient({
            region: awsConfig.region,
            credentials: {
                accessKeyId: awsConfig.accessKey,
                secretAccessKey: awsConfig.secretKey,
            },
            maxAttempts: props.retries,
        });

        node.on('input', async function(msg, send, done) {
            const messageListToDelete = [];
            const sqsUrl = mustache.render(node.sqsUrl, msg);

            const messageCommand = new ReceiveMessageCommand({
                QueueUrl: sqsUrl,
                AttributeNames: [],
                MessageAttributeNames: [],
                MaxNumberOfMessages: node.maxMessage,
                VisibilityTimeout: node.visibilityTimeout,
                WaitTimeSeconds: node.waitTimeSeconds,
                ReceiveRequestAttemptId: node.requestAttemptId
            });

            try {
                const messages = await client.send(messageCommand);
                if (messages.Messages) {
                    messages.Messages?.forEach((message) => {
                        messageListToDelete.push({
                            Id: message.MessageId,
                            ReceiptHandle: message.ReceiptHandle
                        });

                        send([{ ...msg, payload: message }, null]);
                    });
                }
            } catch (error) {
                send([null, error]);
            }

            if (messageListToDelete.length) {
                await deleteMessage(client, sqsUrl, messageListToDelete);
            }

            done();
        });
    }

    RED.nodes.registerType('aws-cloud-sqs-read', SQSReadMessage);
}