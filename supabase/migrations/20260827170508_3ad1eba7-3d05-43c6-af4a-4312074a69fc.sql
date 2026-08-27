INSERT INTO app_settings (key, value) VALUES ('whatsapp_support_number', '{"number": "237690722316"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

UPDATE vendors SET contact_phone = '+237690722316' WHERE slug = 'wintek';