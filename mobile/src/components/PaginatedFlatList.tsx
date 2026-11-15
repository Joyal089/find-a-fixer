import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { colours, MAX_CONTENT_WIDTH, spacing } from '@/constants/theme';
import type { PaginatedList } from '@/hooks/usePaginatedList';

import { EmptyState, LoadingView, Notice } from './Feedback';

interface PaginatedFlatListProps<T> {
  list: PaginatedList<T>;
  renderItem: (item: T) => ReactElement;
  emptyTitle: string;
  emptyMessage: string;
  header?: ReactElement;
}

/**
 * One list component for every paged list (job feed, my jobs, leads): pull to refresh,
 * load more on scroll, and consistent loading, empty and error states.
 */
export function PaginatedFlatList<T extends { id: string }>({
  list,
  renderItem,
  emptyTitle,
  emptyMessage,
  header,
}: PaginatedFlatListProps<T>) {
  if (list.loading) return <LoadingView />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => renderItem(item)}
      ItemSeparatorComponent={Separator}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          tintColor={colours.accent}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {list.error ? <Notice tone="error" message={list.error} /> : null}
        </View>
      }
      ListEmptyComponent={
        list.error ? undefined : <EmptyState title={emptyTitle} message={emptyMessage} />
      }
      ListFooterComponent={
        list.loadingMore ? (
          <ActivityIndicator color={colours.accent} style={styles.footer} />
        ) : undefined
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colours.background },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: spacing.md,
  },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  separator: { height: spacing.md },
  footer: { padding: spacing.md },
});
