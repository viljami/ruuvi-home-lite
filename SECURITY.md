# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Ruuvi Home Lite, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Send an email to the maintainers describing the vulnerability
3. Include steps to reproduce the issue
4. Allow reasonable time for the issue to be addressed before public disclosure

## Security Features

### Authentication & Authorization

- **MQTT Authentication**: Strong password-based authentication for MQTT broker
- **TLS Encryption**: All MQTT communication encrypted with TLS 1.2+
- **Self-signed Certificates**: Generated during setup for local network use
- **Access Control Lists**: MQTT topics restricted by user permissions

### Password Security

- **Strong Password Generation**: 16-character random passwords with mixed case and numbers
- **Secure Storage**: Passwords stored in `.env` file with 600 permissions (user-only access)
- **No Hardcoded Credentials**: All sensitive values loaded from environment variables
- **Password Rotation**: Manual password rotation supported via setup script

### Network Security

- **HTTPS Only**: Web interface served over HTTPS with TLS certificates
- **Local Network Only**: Designed for local network deployment, not internet-facing
- **Port Security**: Minimal port exposure (MQTT 8883, HTTPS 3000)
- **Certificate Validation**: Self-signed certificates for local development

### Data Privacy

- **Minimal Data Exposure**: API only exposes temperature and humidity via WebSocket
- **Local Storage**: All sensor data stored locally in SQLite database
- **No Cloud Dependencies**: System operates entirely offline
- **Data Retention**: User controls data retention through local database management

## Security Considerations

### Known Limitations

- **Self-signed Certificates**: Certificates generated during setup are self-signed
- **Local Network Trust**: System assumes trusted local network environment
- **No User Management**: Single-user system with MQTT-level authentication only
- **Certificate Expiry**: Generated certificates valid for 10 years, manual renewal required

### Production Deployment

#### Required Security Measures

1. **Change Default Credentials**: Run setup script to generate unique passwords
2. **Secure File Permissions**: Ensure `.env` file has 600 permissions
3. **Regular Updates**: Keep dependencies updated via `npm audit`
4. **Network Isolation**: Deploy on isolated/trusted network segments
5. **Certificate Management**: Monitor certificate expiry and renew as needed

#### Recommended Security Measures

1. **Firewall Configuration**: Restrict access to MQTT (8883) and HTTPS (3000) ports
2. **Log Monitoring**: Monitor PM2 logs for unusual activity
3. **Database Backup**: Regular SQLite database backups with encryption
4. **System Updates**: Keep underlying OS and Node.js runtime updated
5. **Access Logging**: Monitor MQTT broker access logs

### Environment Variables

Never commit the following files to version control:
- `.env` - Contains MQTT passwords and configuration
- `*.key` - Private keys for TLS certificates
- `*.db` - SQLite database files with sensor data
- `logs/` - Application logs may contain sensitive information

### Dependencies

This project uses minimal dependencies to reduce attack surface:
- `mqtt` - MQTT client library
- `sqlite3` - Database interface
- `ws` - WebSocket implementation

Run `npm audit` regularly to check for known vulnerabilities in dependencies.

## Compliance

### GDPR Considerations

- **Local Processing**: All data processed locally, no third-party data sharing
- **User Control**: Users have full control over their sensor data
- **Data Portability**: SQLite database can be exported in standard format
- **Right to Erasure**: Users can delete database to remove all collected data

### Data Minimization

- Only essential sensor data (temperature, humidity, timestamp, MAC) exposed via API
- Additional sensor data (pressure, battery, acceleration) stored but not exposed
- No personal information collected beyond sensor MAC addresses
- Configurable data retention through database management

## Security Updates

Security updates will be published as GitHub releases with clear changelog entries. 
Monitor the repository for security-related updates and apply them promptly.

## Audit History

- Initial security review: Project inception
- Dependency audit: Run `npm audit` before each release
- Security documentation: Updated with each significant feature addition

For questions about security practices or to suggest improvements, please open a GitHub issue with the "security" label.