#!/bin/sh

url="http://localhost:8080"

test -e config.json && {
	echo "Config already exists, please remove 'config.json' and try" \
		" again (or edit the configuration manually)" >&2
	exit 1
}

sed \
	-e 's|"graphitusUrl": ".*",|"graphitusUrl": "'$url'",|' \
	-e 's|"graphiteUrl": ".*",|"graphiteUrl": "'$url'/graphite",|' \
	config.sample.json > config.json
