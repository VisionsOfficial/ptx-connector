import {getAmpq, getEndpoint, getKafka, getWebsocket} from "../libs/loaders/configuration";
import amqp from "amqplib";
import {DataExchangeStatusEnum} from "./enums/dataExchangeStatusEnum";
import {Logger} from "../libs/loggers";
import {Kafka} from "kafkajs";
import {IDataExchange} from "./types/dataExchange";

/**
 * AMQP Publisher
 * use amqp package to publish a message to a queue using the configuration
 * @param dataExchange
 */
export const amqpPublisher = async(dataExchange: IDataExchange) => {
    if(getAmpq()){
        try {
            const connection = await amqp.connect(getAmpq()?.host);
            const channel = await connection.createChannel();

            const queueName = getAmpq()?.queue ?? 'pdc';
            await channel.assertQueue(queueName, { durable: true });

            channel.sendToQueue(queueName, Buffer.from(JSON.stringify(dataExchange)), {
                persistent: true
            });

            setTimeout(() => connection.close().then(() => Logger.info({message: 'Closing amqp connexion', location: 'amqpPublisher'})), 500);

        } catch (error) {
            if(dataExchange.status === DataExchangeStatusEnum.TRANSFER_STARTED) {
                await dataExchange.updateStatus(
                    DataExchangeStatusEnum.TRANSFER_FAILED,
                    error.message,
                    await getEndpoint()
                );
            }
            Logger.error({
                message: error.message,
                location: 'amqpPublisher',
            });
        }
    }
}

/**
 * Kafka Publisher
 * use kafkajs package to publish a message to a topic using the configuration
 * @param dataExchange
 */
export const kafkaPublisher = async(dataExchange: IDataExchange) => {
    if(getKafka()){
        try {
            const kafka = new Kafka({
                brokers: getKafka()?.brokers,
            })

            const producer = kafka.producer()

            async function run() {
                await producer.connect()
                await producer.send({
                    topic: getKafka()?.topic ?? 'pdc',
                    messages: [{ value: JSON.stringify(dataExchange) }],
                })

            }

            await run()

            await producer.disconnect().then(() => Logger.info({message: 'Closing kafka connexion', location: 'kafkaPublisher'}));

        } catch (error) {
            if(dataExchange.status === DataExchangeStatusEnum.TRANSFER_STARTED) {
                await dataExchange.updateStatus(
                    DataExchangeStatusEnum.TRANSFER_FAILED,
                    error.message,
                    await getEndpoint()
                );
            }
            Logger.error({
                message: error.message,
                location: 'kafkaPublisher',
            });
        }
    }
}

/**
 * WebSocket Publisher
 * use WebSocket to publish a message to a websocket server using the configuration
 * @param dataExchange
 */
export const websocketPublisher = async(dataExchange: IDataExchange) => {
    if(getWebsocket()){
        try {
            const ws = new WebSocket(getWebsocket()?.uri ?? '');

            ws.onopen = () => {
                ws.send(JSON.stringify(dataExchange));

                ws.close();
            }

            ws.onclose = () => {
                Logger.info({
                    message: 'Closing websocket connexion',
                    location: 'websocketPublisher',
                });
            }
        } catch (error) {
            if(dataExchange.status === DataExchangeStatusEnum.TRANSFER_STARTED) {
                await dataExchange.updateStatus(
                    DataExchangeStatusEnum.TRANSFER_FAILED,
                    error.message,
                    await getEndpoint()
                );
            }
            Logger.error({
                message: error.message,
                location: 'consumerExchange - WEBSOCKET',
            });
        }
    }
}