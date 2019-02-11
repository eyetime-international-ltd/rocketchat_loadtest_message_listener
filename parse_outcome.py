#!/usr/bin/env python2.7

import io
import sys
import json
import re
import numpy as np

if len(sys.argv) < 2:
    print "Usage: ./parse_outcome.py [filename]"
    exit()


totalMsgs = failedMsgs = succeededMsgs = receivedMsgs = 0
msgSentDurations = []
msgReceivedDurations = []

with io.open(sys.argv[1]) as fp:
    for line in fp:
        content = '{' + re.search(r'\{(.*)\}', line).group(1) + '}'
        try:
            obj = json.loads(content)
            if obj['type'] == 'receiver':
                receivedMsgs += obj['msgTotal']
                msgReceivedDurations += obj['msgDurations'] 
            else:
                totalMsgs += obj['msgTotal']
                succeededMsgs += obj['msgSuccess']
                failedMsgs += obj['msgFail']
                msgSentDurations += obj['msgDurations'] 
        except Exception as ex:
            print(ex)

print "----------------------------------------"
print " Total Messages:               {:10.2f}".format(totalMsgs)
print " Failed Messages:              {:10.2f}".format(failedMsgs)
print " Received Messages:            {:10.2f}".format(receivedMsgs)
print " Succeeded Messages:           {:10.2f}".format(succeededMsgs)
print " Average Duration Sent:        {:10.2f} ms".format(np.mean(msgSentDurations))
print " Standard deviation Sent:      {:10.2f} ms".format(np.std(msgSentDurations))
print " Max Duration Sent:            {:10.2f} ms".format(np.max(msgSentDurations))
print " Min Duration Sent:            {:10.2f} ms".format(np.min(msgSentDurations))
print " Average Duration Received:    {:10.2f} ms".format(np.mean(msgReceivedDurations))
print " Standard deviation Received:  {:10.2f} ms".format(np.std(msgReceivedDurations))
print " Max Duration Received:        {:10.2f} ms".format(np.max(msgReceivedDurations))
print " Min Duration Received:        {:10.2f} ms".format(np.min(msgReceivedDurations))
# print " 99th percentile:         {:10.2f} ms".format(np.percentile(msgSentDurations, 99))
# print " 95th percentile:         {:10.2f} ms".format(np.percentile(msgSentDurations, 95))
# print " 90th percentile:         {:10.2f} ms".format(np.percentile(msgSentDurations, 90))
print "----------------------------------------"
