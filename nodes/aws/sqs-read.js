module.exports = function(RED) {

    const { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } = require("@aws-sdk/client-sqs");
    const mustache = require('mustache');

    const deleteMessage = async (client, sqsUrl, messages) => {
        const command = new DeleteMessageBatchCommand({
            QueueUrl: sqsUrl,
            Entries: messages
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
        this.sendBatch = props.sendBatch;
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

            let messageListToDelete = [];
            const sqsUrl = mustache.render(node.sqsUrl, msg);

            const messageRequest = new ReceiveMessageCommand({
                QueueUrl: sqsUrl,
                AttributeNames: [],
                MessageAttributeNames: [],
                MaxNumberOfMessages: node.maxMessage,
                VisibilityTimeout: node.visibilityTimeout,
                WaitTimeSeconds: node.waitTimeSeconds,
                ReceiveRequestAttemptId: node.requestAttemptId
            });

            try {
                const messages = await client.send(messageRequest);
                if (messages.Messages) {
                    if (node.deleteAfterRead) {
                        messageListToDelete = messages.Messages.map(messages => ({
                            Id: messages.MessageId,
                            ReceiptHandle: messages.ReceiptHandle
                        }));
                    }

                    if (node.sendBatch) {
                        send([{
                            ...msg,
                            payload: messages.Messages
                        }, null]);
                    } else {
                        messages.Messages?.map((message) => {
                            send([{
                                ...msg,
                                payload: message
                            }, null]);
                        });
                    }
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