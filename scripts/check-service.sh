#!/bin/bash
# Check if service is running
systemctl status dev-cloud-sync-ui.service

# Check logs
journalctl -u dev-cloud-sync-ui.service -n 50 --no-pager
