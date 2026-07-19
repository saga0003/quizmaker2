-- Optional standalone hotfix for Version 3.1 users.
-- Version 4 migration already includes this change.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
      'image/bmp','image/avif','image/x-icon','image/vnd.microsoft.icon',
      'image/tiff','image/heic','image/heif'
    ]
where id = 'question-assets';

select id, file_size_limit, allowed_mime_types
from storage.buckets
where id='question-assets';
