import os
import time
import json
import logging
import threading

import numpy as np
from keras.models import load_model

from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2
from stream_manager import (
    ReadMessagesOptions,
    StreamManagerClient,
)

import awsiot.greengrasscoreipc
from awsiot.greengrasscoreipc.model import GetThingShadowRequest


# TFLite does not support LSTM yet
# TODO: Replace Keras with TFLite for better performance once it's supported
# https://www.tensorflow.org/lite/guide/roadmap
# import tflite_runtime.interpreter as tflite


# These are the same parameters we used in model training
NUM_STEPS = 4
USED_FEATURES = [
    "zrmsvelocity",
    "temperature",
    "xrmsvelocity",
    "xpeakacceleration",
    "zpeakacceleration",
    "zrmsacceleration",
    "xrmsacceleration",
    "zkurtosis",
    "xkurtosis",
    "zcrestfactor",
    "xcrestfactor",
    "zpeakvelocity",
    "xpeakvelocity",
    "zhfrmsacceleration",
    "xhfrmsacceleration",
]
NUM_FEATURES = len(USED_FEATURES)


GREENGRASS_GROUP_ID = os.environ["GREENGRASS_GROUP_ID"]
GREENGRASS_GROUP_NAME = os.environ["GREENGRASS_GROUP_NAME"]
GREENGRASS_THING_NAME = os.environ["GREENGRASS_THING_NAME"]
DEBUG_TOPIC = "debug/PredictRUL/" + GREENGRASS_GROUP_ID
# PREDICTION_TOPIC = "predmaint/device-health/factory-luxembourg-grinder/rul"  # "prediction/"+ GREENGRASS_GROUP_ID
PREDICTION_TOPIC = "prediction/" + GREENGRASS_THING_NAME

PREDICTION_STREAM_NAME = os.environ["PREDICTION_STREAM_NAME"]

MODEL_FILE = "model/LSTM.h5"

TIMEOUT = 10

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


ggclient = GreengrassCoreIPCClientV2()
streamclient = StreamManagerClient()
ipc_client_v1 = awsiot.greengrasscoreipc.connect()


def sample_get_thing_shadow_request(thingName, shadowName):
    try:
        get_thing_shadow_request = GetThingShadowRequest()
        get_thing_shadow_request.thing_name = thingName
        get_thing_shadow_request.shadow_name = shadowName

        op = ipc_client_v1.new_get_thing_shadow()
        op.activate(get_thing_shadow_request)
        fut = op.get_response()
        result = fut.result(TIMEOUT)

        return result.payload

    except Exception as e:
        logger.error("Invalid arguments error: %s", e)


def json_converter(o):
    if isinstance(o, np.float32):
        return float(o)


def publish(topic, message):
    try:
        ggclient.publish_to_iot_core(topic_name=topic, qos="1", payload=message)
    except Exception as e:
        logger.error("Failed to publish message: " + repr(e))


def get_shadow_reported_status():
    thing_shadow = sample_get_thing_shadow_request(
        GREENGRASS_THING_NAME, GREENGRASS_THING_NAME
    )
    shadow = json.loads(thing_shadow.decode("utf-8"))
    try:
        return shadow["state"]["reported"]["vibration-status"]
    except Exception as e:
        logger.error("Failed to get shadow: " + repr(e))
        return


def predict_rul():
    global model
    last_read_seq_num = 0

    while True:
        try:
            status = get_shadow_reported_status()
            if status == "run":
                try:
                    messages = streamclient.read_messages(
                        PREDICTION_STREAM_NAME,
                        ReadMessagesOptions(
                            desired_start_sequence_number=last_read_seq_num + 1,
                            min_message_count=NUM_STEPS,
                            max_message_count=NUM_STEPS,
                            read_timeout_millis=0,  # return immediately if there are not enough messages in the stream yet
                        ),
                    )
                    logger.info(
                        f"Successfully read {len(messages)} starting from {last_read_seq_num + 1} to {messages[-1].sequence_number}"
                    )
                    last_read_seq_num = messages[-1].sequence_number

                    # form the input message in the pre-defined shape and order
                    inputs = []
                    last_message_in_batch = {}
                    for message in messages:
                        payload = json.loads(message.as_dict()["payload"].decode())
                        inp = []
                        # Crucial: this must be in correct order!
                        for feature in USED_FEATURES:
                            inp.append(payload[feature])
                        inputs.append(inp)
                        last_message_in_batch = payload

                    try:
                        # format the input
                        inputs_array = np.array(inputs)
                        inputs_shaped = np.reshape(
                            inputs_array, newshape=(-1, NUM_STEPS, NUM_FEATURES)
                        )

                        # predict
                        prediction = model.predict(inputs_shaped)
                        output = {
                            "timestamp": round(time.time() * 1000),
                            "RUL": prediction[0][0],
                            # TODO: raw data should be published by ReadSensor Lambda to a separate topic
                            # this is only the last reading of NUM_STEPS messages
                            "pH": last_message_in_batch["zrmsvelocity"],  # tmp
                            "temperature": last_message_in_batch["temperature"],
                            "salinity": last_message_in_batch[
                                "zpeakacceleration"
                            ],  # tmp
                            "disolvedO2": last_message_in_batch["xkurtosis"],  # tmp
                            "zrmsvelocity": last_message_in_batch["zrmsvelocity"],
                            "xrmsvelocity": last_message_in_batch["xrmsvelocity"],
                            "xpeakacceleration": last_message_in_batch[
                                "xpeakacceleration"
                            ],
                            "zpeakacceleration": last_message_in_batch[
                                "zpeakacceleration"
                            ],
                            "zrmsacceleration": last_message_in_batch[
                                "zrmsacceleration"
                            ],
                            "xrmsacceleration": last_message_in_batch[
                                "xrmsacceleration"
                            ],
                            "zkurtosis": last_message_in_batch["zkurtosis"],
                            "xkurtosis": last_message_in_batch["xkurtosis"],
                            "zcrestfactor": last_message_in_batch["zcrestfactor"],
                            "xcrestfactor": last_message_in_batch["xcrestfactor"],
                            "zpeakvelocity": last_message_in_batch["zpeakvelocity"],
                            "xpeakvelocity": last_message_in_batch["xpeakvelocity"],
                            "zhfrmsacceleration": last_message_in_batch[
                                "zhfrmsacceleration"
                            ],
                            "xhfrmsacceleration": last_message_in_batch[
                                "xhfrmsacceleration"
                            ],
                        }
                        logger.info("Prediction: {}s".format(prediction[0][0]))
                        publish(
                            PREDICTION_TOPIC, json.dumps(output, default=json_converter)
                        )
                    except:
                        logger.exception("Prediction Exception")

                except NotEnoughMessagesException as e:
                    logger.info(
                        "Not Enough Messages ("
                        + str(last_read_seq_num)
                        + ") Exception: "
                        + repr(e)
                    )
                except Exception as e:
                    logger.exception("Read Messages Exception: " + repr(e))

            else:
                # not running, no predictions
                logger.info("Not in RUN state, not doing prediction")

        except Exception as e:
            logger.exception("Shadow Exception: " + repr(e))

        time.sleep(1)


model = load_model(MODEL_FILE)

thread2 = threading.Thread(target=predict_rul)
thread2.start()
