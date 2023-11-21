import os
import sys
import time
import uuid
import json
import logging
import asyncio
import threading
from threading import Timer
import minimalmodbus

from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2
from stream_manager import (
    ExportDefinition,
    KinesisConfig,
    MessageStreamDefinition,
    ReadMessagesOptions,
    ResourceNotFoundException,
    StrategyOnFull,
    StreamManagerClient,
    IoTAnalyticsConfig,
)

import awsiot.greengrasscoreipc
import awsiot.greengrasscoreipc.client as client
from awsiot.greengrasscoreipc.model import GetThingShadowRequest
from awsiot.greengrasscoreipc.model import UpdateThingShadowRequest
from awsiot.greengrasscoreipc.model import ListNamedShadowsForThingRequest


# get from the environment variable, defined in green-app.json
GREENGRASS_GROUP_ID = os.environ["GREENGRASS_GROUP_ID"]
GREENGRASS_GROUP_NAME = os.environ["GREENGRASS_GROUP_NAME"]
GREENGRASS_THING_NAME = os.environ["GREENGRASS_THING_NAME"]
DEBUG_TOPIC = "debug/ReadSensor/" + GREENGRASS_GROUP_ID
RAW_DATA_TOPIC = "predmaint/device-health/factory-luxembourg-grinder/rul"  # "predmaint/device-health/" + GREENGRASS_GROUP_ID + "/raw"

PREDICTION_STREAM_NAME = os.environ["PREDICTION_STREAM_NAME"]
TRAINING_STREAM_NAME = os.environ["TRAINING_STREAM_NAME"]
IOT_ANALYTICS_CHANNEL_NAME = os.environ["IOT_ANALYTICS_CHANNEL_NAME"]

MODBUS_DEVICE = os.environ["MODBUS_DEVICE"]
MODBUS_SLAVE_ADDRESS = int(os.environ["MODBUS_SLAVE_ADDRESS"])
MODBUS_READING_INTERVAL = int(os.environ["MODBUS_READING_INTERVAL"])

TIMEOUT = 10

initial_state = """{"state": {"reported": {"max-vibration": 50,"motor-speed": 35, "vibration-status": "run"}}}"""

ggclient = GreengrassCoreIPCClientV2()
streamclient = StreamManagerClient()
ipc_client_v1 = awsiot.greengrasscoreipc.connect()


def sample_list_named_shadows_for_thing_request(thingName):
    try:
        # create the ListNamedShadowsForThingRequest request
        list_named_shadows_for_thing_request = ListNamedShadowsForThingRequest()
        list_named_shadows_for_thing_request.thing_name = thingName

        # retrieve the ListNamedShadowsForThingRequest response after sending the request to the IPC server
        op = ipc_client_v1.new_list_named_shadows_for_thing()
        op.activate(list_named_shadows_for_thing_request)
        fut = op.get_response()
        list_result = fut.result(TIMEOUT)
        named_shadow_list = list_result.results

        return named_shadow_list

    except Exception as e:
        logger.error(e)


def sample_update_thing_shadow_request(thingName, shadowName, payload):
    try:
        # create the UpdateThingShadow request
        update_thing_shadow_request = UpdateThingShadowRequest()
        update_thing_shadow_request.thing_name = thingName
        update_thing_shadow_request.shadow_name = shadowName
        update_thing_shadow_request.payload = payload

        # retrieve the UpdateThingShadow response after sending the request to the IPC server
        op = ipc_client_v1.new_update_thing_shadow()
        op.activate(update_thing_shadow_request)
        fut = op.get_response()

        result = fut.result(TIMEOUT)
        return result.payload

    except Exception as e:
        logger.error(e)


def initialise_shadow():
    try:
        list = sample_list_named_shadows_for_thing_request(GREENGRASS_THING_NAME)
        # if GREENGRASS_THING_NAME not in list:
        if True:
            sample_update_thing_shadow_request(
                GREENGRASS_THING_NAME,
                GREENGRASS_THING_NAME,
                bytes(initial_state, "utf-8"),
            )
    except Exception as e:
        logger.error(e)


def sample_get_thing_shadow_request(thingName, shadowName):
    try:
        # create the GetThingShadow request
        get_thing_shadow_request = GetThingShadowRequest()
        get_thing_shadow_request.thing_name = thingName
        get_thing_shadow_request.shadow_name = shadowName

        # retrieve the GetThingShadow response after sending the request to the IPC server
        op = ipc_client_v1.new_get_thing_shadow()
        op.activate(get_thing_shadow_request)
        fut = op.get_response()
        result = fut.result(TIMEOUT)

        return result.payload

    except Exception as e:
        logger.error("Invalid arguments error: %s", e)


# registers to read from the vibration sensor
sensor_registers = {
    "zrmsvelocity": {"address": 5201, "number_of_decimals": 3, "signed": False},
    "temperature": {"address": 5203, "number_of_decimals": 2, "signed": True},
    "xrmsvelocity": {"address": 5205, "number_of_decimals": 3, "signed": False},
    "xpeakacceleration": {"address": 5206, "number_of_decimals": 3, "signed": False},
    "zpeakacceleration": {"address": 5207, "number_of_decimals": 3, "signed": False},
    "zrmsacceleration": {"address": 5210, "number_of_decimals": 3, "signed": False},
    "xrmsacceleration": {"address": 5211, "number_of_decimals": 3, "signed": False},
    "zkurtosis": {"address": 5212, "number_of_decimals": 3, "signed": False},
    "xkurtosis": {"address": 5213, "number_of_decimals": 3, "signed": False},
    "zcrestfactor": {"address": 5214, "number_of_decimals": 3, "signed": False},
    "xcrestfactor": {"address": 5215, "number_of_decimals": 3, "signed": False},
    "zpeakvelocity": {"address": 5217, "number_of_decimals": 3, "signed": False},
    "xpeakvelocity": {"address": 5219, "number_of_decimals": 3, "signed": False},
    "zhfrmsacceleration": {"address": 5220, "number_of_decimals": 3, "signed": False},
    "xhfrmsacceleration": {"address": 5221, "number_of_decimals": 3, "signed": False},
}

# set logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Modbus for vibration sensor connection
instrument = minimalmodbus.Instrument(MODBUS_DEVICE, MODBUS_SLAVE_ADDRESS)


### MQTT messaging


def publish(topic, message):
    try:
        ggclient.publish_to_iot_core(topic_name=topic, qos="1", payload=message)
    except Exception as e:
        logger.error("Failed to publish message: " + repr(e))


### Shadow Operations


def get_shadow_reported_max_vibration():
    thing_shadow = sample_get_thing_shadow_request(
        GREENGRASS_THING_NAME, GREENGRASS_THING_NAME
    )
    shadow = json.loads(thing_shadow["payload"].decode("utf-8"))
    try:
        return shadow["state"]["reported"]["max-vibration"]
    except:
        return


def get_shadow_reported_motor_speed():
    thing_shadow = sample_get_thing_shadow_request(
        GREENGRASS_THING_NAME, GREENGRASS_THING_NAME
    )
    shadow = json.loads(thing_shadow["payload"].decode("utf-8"))
    try:
        return shadow["state"]["reported"]["motor-speed"]
    except:
        return


def get_shadow_reported_status():
    thing_shadow = sample_get_thing_shadow_request(
        GREENGRASS_THING_NAME, GREENGRASS_THING_NAME
    )
    shadow = json.loads(thing_shadow.decode("utf-8"))
    try:
        status = shadow["state"]["reported"]["vibration-status"]
        return status
    except Exception as e:
        logger.error("Failed to get shadow: " + repr(e))
        return


### Hardware Operations


def read_registers():
    start = time.process_time()
    data = {}

    # read registers one by one
    for k, v in sensor_registers.items():
        try:
            reading = instrument.read_register(
                v["address"],
                number_of_decimals=v["number_of_decimals"],
                signed=v["signed"],
            )
            data[k] = reading
        except:
            logger.error("Error reading " + k)
    data["timestamp"] = round(time.time() * 1000)

    logger.info(
        "read_registers duration: " + str(round(time.process_time() - start, 3)) + "s"
    )
    return data


### Collect Data Thread


def collect_data():
    try:
        status = get_shadow_reported_status()
        logger.info("status: " + status)

        data = read_registers()

        if status == "run":
            try:
                sequence_number = streamclient.append_message(
                    stream_name=PREDICTION_STREAM_NAME,
                    data=json.dumps(data).encode("utf-8"),
                )
                logger.info(
                    "Appended message {} into Prediction Stream".format(sequence_number)
                )
            except Exception as e:
                logger.error("Failed to append message: " + repr(e))

            print("Publishing raw data to " + RAW_DATA_TOPIC)
            publish(RAW_DATA_TOPIC, json.dumps(data))

        elif status == "train":
            # additional field for training
            data["max_vibration"] = get_shadow_reported_max_vibration()
            data["motor_speed"] = get_shadow_reported_motor_speed()
            # additional field for identifying the device in the cloud
            data["GREENGRASS_GROUP_ID"] = GREENGRASS_GROUP_ID

            # append into the training stream
            try:
                sequence_number = streamclient.append_message(
                    stream_name=TRAINING_STREAM_NAME,
                    data=json.dumps(data).encode("utf-8"),
                )
                logger.info(
                    "Appended message {} into Training Stream".format(sequence_number)
                )
            except Exception as e:
                logger.error("Failed to append message: " + repr(e))

    except Exception as e:
        logger.error("Failed while collecting data: " + repr(e))

    Timer(MODBUS_READING_INTERVAL, collect_data).start()


### Main Function


def main():
    try:
        # Try deleting the stream (if it exists) so that we have a fresh start
        try:
            streamclient.delete_message_stream(stream_name=TRAINING_STREAM_NAME)
        except ResourceNotFoundException:
            pass

        exports = ExportDefinition(
            iot_analytics=[
                IoTAnalyticsConfig(
                    identifier="IotAnalyticsExport",
                    iot_channel=IOT_ANALYTICS_CHANNEL_NAME,
                )
            ],
            kinesis=[
                KinesisConfig(
                    identifier="KinesisExport", kinesis_stream_name=TRAINING_STREAM_NAME
                )
            ],
        )
        streamclient.create_message_stream(
            MessageStreamDefinition(
                name=TRAINING_STREAM_NAME,
                strategy_on_full=StrategyOnFull.OverwriteOldestData,
                # persistence=Persistence.Memory,
                export_definition=exports,
            )
        )
    except asyncio.TimeoutError:
        logger.exception("Timed out while executing")
    except Exception as e:
        logger.exception("Exception while creating training stream" + repr(e))

    try:
        # Try deleting the stream (if it exists) so that we have a fresh start
        try:
            streamclient.delete_message_stream(stream_name=PREDICTION_STREAM_NAME)
        except ResourceNotFoundException:
            pass

        streamclient.create_message_stream(
            MessageStreamDefinition(
                name=PREDICTION_STREAM_NAME,
                strategy_on_full=StrategyOnFull.OverwriteOldestData,
                # persistence=Persistence.Memory
            )
        )
    except asyncio.TimeoutError:
        logger.exception("Timed out while executing")
    except Exception as e:
        logger.exception("Exception while creating prediction stream" + repr(e))

    try:
        initialise_shadow()
    except:
        raise Exception("Failed to initialise Shadow")

    try:
        threading.Thread(target=collect_data).start()
    except Exception as e:
        logger.error("Failed start data collection thread: " + repr(e))
        raise Exception("Failed create message stream")


main()
