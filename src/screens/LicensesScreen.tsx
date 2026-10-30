import { APP_NAME } from '../appName';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import data from '../legal/licenses.json';
import { useColors } from '../theme/colors';
import { readingColumn } from '../theme/layout';

type Entry = { name: string; version?: string; license: string; text?: string };

const texts = data.texts as Record<string, string>;

// What ships in the app: the JavaScript packages, then the native pods
const entries: Entry[] = [...(data.packages as Entry[]), ...(data.pods as Entry[])];

/** The licences of everything the app is built from, as the licences require. Tap one to read its text. */
export function LicensesScreen() {
  const c = useColors();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.list}
      data={entries}
      keyExtractor={e => e.name}
      ListHeaderComponent={
        <Text style={{ color: c.muted }}>
          {APP_NAME} is licensed under the Apache License 2.0. It is built on the open-source components below, each under its own licence.
        </Text>
      }
      renderItem={({ item }) => {
        const expanded = open === item.name;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setOpen(expanded ? null : item.name)}
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.name, { color: c.text }]}>
              {item.name}
              {item.version ? ` ${item.version}` : ''}
            </Text>
            <Text style={{ color: c.muted }}>{item.license}</Text>
            {expanded && item.text ? (
              <View style={styles.text}>
                <Text selectable style={[styles.mono, { color: c.text }]}>{texts[item.text]}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, ...readingColumn },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  text: { marginTop: 8 },
  mono: { fontFamily: 'Menlo', fontSize: 11 },
});
