import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  PHOTO_MAX_WIDTH,
} from '@/constants/catalogue';
import type { MediaType, PickedMedia } from '@/types';

import { AppError, throwIfError } from './errors';
import { supabase } from './supabase';

export const JOB_MEDIA_BUCKET = 'job-media';
export const CHAT_MEDIA_BUCKET = 'chat-media';
const SIGNED_URL_SECONDS = 3600;

const VIDEO_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
]);

function toPickedMedia(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  const isVideo = asset.type === 'video';
  return {
    uri: asset.uri,
    type: isVideo ? 'video' : 'photo',
    mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
    width: asset.width,
  };
}

/** Opens the photo library. Returns an empty list if the user backs out. */
export async function pickMedia(options: {
  allowVideo: boolean;
  limit: number;
}): Promise<PickedMedia[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: options.allowVideo ? ['images', 'videos'] : ['images'],
    allowsMultipleSelection: options.limit > 1,
    selectionLimit: options.limit,
    videoMaxDuration: MAX_VIDEO_SECONDS,
    quality: 1,
  });
  return result.canceled ? [] : result.assets.map(toPickedMedia);
}

/** Shrinks and re-encodes a photo as JPEG so uploads are small and fast. */
async function compressPhoto(photo: PickedMedia): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (photo.width > PHOTO_MAX_WIDTH) context.resize({ width: PHOTO_MAX_WIDTH });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return saved.uri;
}

interface PreparedFile {
  uri: string;
  contentType: string;
  extension: string;
  maxBytes: number;
}

async function prepare(item: PickedMedia): Promise<PreparedFile> {
  if (item.type === 'photo') {
    const uri = await compressPhoto(item);
    return { uri, contentType: 'image/jpeg', extension: 'jpg', maxBytes: MAX_PHOTO_BYTES };
  }
  const extension = VIDEO_EXTENSIONS.get(item.mimeType);
  if (!extension) throw new AppError('UNSUPPORTED_FILE');
  return { uri: item.uri, contentType: item.mimeType, extension, maxBytes: MAX_VIDEO_BYTES };
}

/**
 * Uploads one file into `folder` and returns its storage path. The bucket enforces
 * type and size again on the server; checking here just fails faster.
 */
export async function uploadMedia(
  bucket: string,
  folder: string,
  item: PickedMedia,
): Promise<{ path: string; type: MediaType }> {
  const file = await prepare(item);
  const response = await fetch(file.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > file.maxBytes) throw new AppError('FILE_TOO_LARGE');

  const path = `${folder}/${randomUUID()}.${file.extension}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.contentType, upsert: false });
  throwIfError(error);
  return { path, type: item.type };
}

/** Signed URLs for private files, keyed by storage path. One request for the whole batch. */
export async function signUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  throwIfError(error);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
