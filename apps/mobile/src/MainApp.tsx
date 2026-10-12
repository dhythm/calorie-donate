import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  ApiClientError,
  addDays,
  type ApiClient,
  type Meal,
  type Overview,
  type Profile,
} from '@calorie-donate/api';
import { Loading, Notice } from './components';
import { describeError } from './errors';
import { DonationsScreen } from './screens/DonationsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MealScreen } from './screens/MealScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { colors } from './theme';

type Tab = 'home' | 'record' | 'history' | 'donations' | 'settings';

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'ホーム', icon: '⌂' },
  { key: 'history', label: 'グラフ', icon: '▥' },
  { key: 'record', label: '記録', icon: '＋' },
  { key: 'donations', label: '寄付', icon: '♥' },
  { key: 'settings', label: '設定', icon: '⚙' },
];

type Session = { today: string; profile: Profile | null };

export function MainApp({ api, baseUrl }: { api: ApiClient; baseUrl: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [recordDate, setRecordDate] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const loadSession = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    api.overview().then(
      (overview) => {
        if (!active) return;
        setSession({ today: overview.today, profile: overview.profile });
        setLoadError(null);
      },
      (error: unknown) => {
        if (active) setLoadError(describeError(error));
      },
    );
    return () => {
      active = false;
    };
  }, [api, reloadKey]);

  const handleOverview = useCallback((overview: Overview) => {
    setSession((current) =>
      current &&
      current.today === overview.today &&
      current.profile?.updatedAt === overview.profile?.updatedAt
        ? current
        : { today: overview.today, profile: overview.profile },
    );
  }, []);

  const handleApiError = useCallback(
    (error: unknown) => {
      if (
        error instanceof ApiClientError &&
        error.code === 'PROFILE_REQUIRED'
      ) {
        loadSession();
      }
    },
    [loadSession],
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {loadError ? (
          <View style={styles.centered}>
            <Notice
              message={loadError}
              onRetry={() => {
                setLoadError(null);
                loadSession();
              }}
            />
          </View>
        ) : (
          <Loading />
        )}
      </SafeAreaView>
    );
  }

  const { today, profile } = session;
  if (!profile) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <OnboardingScreen
          api={api}
          onDone={(saved) => {
            setSession({ today, profile: saved });
            setTab('home');
          }}
        />
      </SafeAreaView>
    );
  }

  const yesterday = addDays(today, -1);
  const editableDates = [today, yesterday];

  function openRecord(date: string | null, meal: Meal | null) {
    setEditingMeal(meal);
    setRecordDate(date);
    setTab('record');
  }

  function selectTab(next: Tab) {
    if (next === 'record') {
      const date =
        selectedDate && editableDates.includes(selectedDate)
          ? selectedDate
          : today;
      openRecord(date, null);
      return;
    }
    setEditingMeal(null);
    setTab(next);
  }

  let content;
  switch (tab) {
    case 'home':
      content = (
        <HomeScreen
          api={api}
          today={today}
          date={selectedDate ?? today}
          onSelectDate={(date) => setSelectedDate(date === today ? null : date)}
          onAddMeal={(date) => openRecord(date, null)}
          onEditMeal={(meal) => openRecord(meal.date, meal)}
          onOverview={handleOverview}
          onApiError={handleApiError}
          onOpenHistory={() => setTab('history')}
        />
      );
      break;
    case 'record':
      content = (
        <MealScreen
          key={editingMeal?.id ?? `new-${recordDate ?? today}`}
          api={api}
          today={today}
          editableDates={editableDates}
          initialDate={recordDate ?? today}
          meal={editingMeal}
          onApiError={handleApiError}
          onSaved={(meal) => {
            setEditingMeal(null);
            setSelectedDate(meal.date === today ? null : meal.date);
            setTab('home');
          }}
          onCancel={() => {
            setEditingMeal(null);
            setTab('home');
          }}
        />
      );
      break;
    case 'history':
      content = (
        <HistoryScreen
          api={api}
          today={today}
          onSelectDay={(date) => {
            setSelectedDate(date === today ? null : date);
            setTab('home');
          }}
        />
      );
      break;
    case 'donations':
      content = <DonationsScreen api={api} profile={profile} today={today} />;
      break;
    case 'settings':
      content = (
        <SettingsScreen
          api={api}
          baseUrl={baseUrl}
          profile={profile}
          onProfileSaved={(saved) => setSession({ today, profile: saved })}
        />
      );
      break;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>{content}</View>
      <TabBar
        active={tab}
        onSelect={selectTab}
        editing={tab === 'record' && editingMeal !== null}
      />
    </SafeAreaView>
  );
}

function TabBar({
  active,
  onSelect,
  editing,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
  editing: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      accessibilityRole="tablist"
    >
      {tabs.map((item) => {
        const selected = item.key === active;
        const isRecord = item.key === 'record';
        const label = isRecord && editing ? '編集' : item.label;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={isRecord ? '食事を記録' : label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.key)}
            style={styles.tab}
          >
            <View
              style={[
                isRecord ? styles.recordIcon : styles.tabIcon,
                isRecord && selected && styles.recordIconActive,
              ]}
            >
              <Text
                style={[
                  styles.tabIconText,
                  selected && styles.tabTextActive,
                  isRecord && styles.recordIconText,
                ]}
              >
                {item.icon}
              </Text>
            </View>
            <Text style={[styles.tabLabel, selected && styles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', padding: 24 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  tabIcon: { height: 28, justifyContent: 'center' },
  tabIconText: { fontSize: 20, color: colors.muted },
  tabLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  recordIcon: {
    width: 44,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIconActive: { backgroundColor: colors.accent },
  recordIconText: { color: colors.onPrimary, fontSize: 20, fontWeight: '700' },
});
