#!/usr/bin/env python3
"""Exercise an installed collector against a real disposable or development cluster."""
import argparse
import base64
import getpass
import json
import ssl
import time
import urllib.error
import urllib.request
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='https://localhost:9200')
parser.add_argument('--ca')
parser.add_argument('--cert')
parser.add_argument('--key')
parser.add_argument('--user')
parser.add_argument('--timeout', type=int, default=90)
args = parser.parse_args()
context = ssl.create_default_context(cafile=args.ca)
if args.cert:
    context.load_cert_chain(args.cert, args.key)
headers = {'Content-Type': 'application/json'}
if args.user:
    token = base64.b64encode((args.user + ':' + getpass.getpass()).encode()).decode()
    headers['Authorization'] = 'Basic ' + token


def request(path, method='GET', body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(args.url.rstrip('/') + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        return json.load(response)


def latest():
    result = request('/.stack-monitoring-*/_search?expand_wildcards=open,hidden', 'POST', {
        'size': 1, 'sort': [{'timestamp': 'desc'}], 'query': {'term': {'kind': 'cluster'}}})
    return result['hits']['hits'][0]['_source'] if result['hits']['hits'] else None


fixture = 'stack-monitoring-smoke-' + uuid.uuid4().hex
try:
    request('/' + fixture, 'PUT', {'settings': {'number_of_shards': 1, 'number_of_replicas': 0}})
    for i in range(5):
        request(f'/{fixture}/_doc/{i}?refresh=true', 'PUT', {'test': i})
    request('/' + fixture + '/_search', 'POST', {'query': {'match_all': {}}})
    workload_finished = int(time.time() * 1000)
    deadline = time.monotonic() + args.timeout
    baseline = None
    while time.monotonic() < deadline:
        try:
            sample = latest()
            if sample and baseline is None:
                baseline = sample['timestamp']
            if sample and sample['timestamp'] > max(baseline, workload_finished) and sample.get('index_rate') is not None:
                detail = request('/.stack-monitoring-*/_search?expand_wildcards=open,hidden', 'POST', {
                    'size': 10, 'query': {'bool': {'filter': [
                        {'term': {'index_name': fixture}}, {'term': {'timestamp': sample['timestamp']}}]}}})
                assert detail['hits']['hits'][0]['_source']['docs'] == 5
                node = request('/.stack-monitoring-*/_search?expand_wildcards=open,hidden', 'POST', {
                    'size': 10, 'query': {'bool': {'filter': [
                        {'term': {'kind': 'node'}}, {'term': {'timestamp': sample['timestamp']}}]}}})
                assert node['hits']['hits'], 'Missing node documents'
                assert sample['index_rate'] >= 0 and sample['search_rate'] >= 0
                assert all(not hit['_source'].get('index_name', '').startswith('.stack-monitoring-') for hit in detail['hits']['hits'])
                print('PASS: periodic samples, node metrics, five indexed documents, rates and authenticated storage')
                break
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
        time.sleep(2)
    else:
        raise AssertionError('Collector did not produce two complete samples before timeout')
finally:
    request('/' + fixture, 'DELETE')
