import { useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colours, fontSize, radius, spacing } from '@/constants/theme';
import type { MediaItem } from '@/types';

const THUMBNAIL_SIZE = 112;

/** Row of thumbnails. Photos open full screen; videos open in the device's player. */
export function MediaStrip({ items }: { items: MediaItem[] }) {
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item, index) =>
          item.type === 'photo' ? (
            <Pressable
              key={item.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${index + 1} of ${items.length}. Tap to enlarge.`}
              onPress={() => setOpenPhoto(item.url)}
            >
              <Image source={{ uri: item.url }} style={styles.thumbnail} />
            </Pressable>
          ) : (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Video ${index + 1} of ${items.length}. Tap to play.`}
              onPress={() => void Linking.openURL(item.url)}
              style={[styles.thumbnail, styles.video]}
            >
              <Text style={styles.play}>▶</Text>
              <Text style={styles.videoLabel}>Video</Text>
            </Pressable>
          ),
        )}
      </ScrollView>

      <Modal
        visible={openPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenPhoto(null)}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={() => setOpenPhoto(null)}
        >
          {openPhoto ? (
            <Image source={{ uri: openPhoto }} style={styles.fullPhoto} resizeMode="contain" />
          ) : null}
          <View style={styles.closeHint}>
            <Text style={styles.closeText}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colours.surfaceRaised,
  },
  video: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colours.border,
    gap: spacing.xs,
  },
  play: { color: colours.accent, fontSize: fontSize.title },
  videoLabel: { color: colours.text, fontSize: fontSize.small },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  fullPhoto: { width: '100%', height: '80%' },
  closeHint: { alignItems: 'center', paddingTop: spacing.md },
  closeText: { color: colours.textMuted, fontSize: fontSize.small },
});
