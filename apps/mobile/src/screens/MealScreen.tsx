import { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  IMAGE_MAX_BYTES,
  MEAL_KCAL_MAX,
  formatDateLabel,
  formatKcal,
  imageMediaTypes,
  mealTypeLabels,
  mealTypes,
  suggestMealType,
  type ApiClient,
  type Estimate,
  type EstimateRequest,
  type Meal,
  type MealInput,
  type MealType,
} from '@calorie-donate/api';
import {
  Badge,
  Button,
  Card,
  Field,
  Loading,
  Notice,
  SectionTitle,
  Segmented,
  parseWholeNumber,
} from '../components';
import { describeError } from '../errors';
import { colors, radius } from '../theme';

type Mode = 'photo' | 'manual';
type ImageMediaType = EstimateRequest['mediaType'];
type Photo = { uri: string; base64: string; mediaType: ImageMediaType };
type ItemRow = { key: number; name: string; kcal: string };

const MAX_ITEMS = 20;
const confidenceLabels: Record<Estimate['confidence'], string> = {
  low: '低',
  medium: '中',
  high: '高',
};

/** Decoded byte length of a base64 string without decoding it. */
function base64DecodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Detects the real image format from its first bytes, falling back to the picker's MIME type. */
function detectMediaType(
  base64: string,
  mimeType: string | undefined,
): ImageMediaType {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  const known = imageMediaTypes.find((type) => type === mimeType);
  return known ?? 'image/jpeg';
}

export function MealScreen({
  api,
  today,
  editableDates,
  initialDate,
  meal,
  onApiError,
  onSaved,
  onCancel,
}: {
  api: ApiClient;
  today: string;
  editableDates: string[];
  initialDate: string;
  meal: Meal | null;
  onApiError: (error: unknown) => void;
  onSaved: (meal: Meal) => void;
  onCancel: () => void;
}) {
  // Initial rows use their index as key, so later rows start above that range.
  const nextKey = useRef(MAX_ITEMS);
  const toRows = (items: { name: string; calories: number }[]): ItemRow[] =>
    items.map((item) => ({
      key: nextKey.current++,
      name: item.name,
      kcal: String(item.calories),
    }));

  const [mode, setMode] = useState<Mode>(
    meal
      ? meal.source === 'photo' && meal.items.length > 0
        ? 'photo'
        : 'manual'
      : 'photo',
  );
  const [name, setName] = useState(meal?.name ?? '');
  const [mealType, setMealType] = useState<MealType>(
    meal?.mealType ?? suggestMealType(new Date().getHours()),
  );
  const [date, setDate] = useState(meal?.date ?? initialDate);
  const [note, setNote] = useState(meal?.note ?? '');
  const [kcalText, setKcalText] = useState(meal ? String(meal.calories) : '');
  const [rows, setRows] = useState<ItemRow[]>(() =>
    meal && meal.source === 'photo'
      ? meal.items.map((item, index) => ({
          key: index,
          name: item.name,
          kcal: String(item.calories),
        }))
      : [],
  );
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  async function runEstimate(target: Photo) {
    setEstimating(true);
    setPhotoError(null);
    try {
      const result = await api.estimateMeal({
        mediaType: target.mediaType,
        imageBase64: target.base64,
      });
      setEstimate(result);
      setName(result.dishName.trim().slice(0, 80));
      setRows(toRows(result.items));
    } catch (caught) {
      setPhotoError(describeError(caught));
      onApiError(caught);
    } finally {
      setEstimating(false);
    }
  }

  async function pickImage(source: 'camera' | 'library') {
    setPhotoError(null);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          '許可が必要です',
          source === 'camera'
            ? 'カメラへのアクセスが許可されていません。端末の設定アプリから許可してください。'
            : '写真へのアクセスが許可されていません。端末の設定アプリから許可してください。',
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        base64: true,
        quality: 0.5,
        allowsEditing: true,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        setPhotoError('画像を読み込めませんでした。別の写真をお試しください。');
        return;
      }
      if (base64DecodedBytes(asset.base64) > IMAGE_MAX_BYTES) {
        setPhotoError(
          `画像が大きすぎます（上限 ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)}MB）。範囲を切り抜くか、別の写真をお試しください。`,
        );
        return;
      }
      const picked: Photo = {
        uri: asset.uri,
        base64: asset.base64,
        mediaType: detectMediaType(asset.base64, asset.mimeType),
      };
      setPhoto(picked);
      setEstimate(null);
      await runEstimate(picked);
    } catch {
      setPhotoError(
        source === 'camera'
          ? 'カメラを起動できませんでした。ライブラリから選択するか、手入力をお試しください。'
          : '写真ライブラリを開けませんでした。もう一度お試しください。',
      );
    }
  }

  function updateRow(key: number, patch: Partial<Omit<ItemRow, 'key'>>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  // Validation
  const trimmedName = name.trim();
  const nameError =
    trimmedName.length === 0
      ? '料理名を入力してください'
      : trimmedName.length > 80
        ? '80文字以内で入力してください'
        : null;
  const noteError =
    note.trim().length > 200 ? '200文字以内で入力してください' : null;
  const rowErrors = rows.map((row) => {
    const kcal = parseWholeNumber(row.kcal);
    if (row.name.trim().length === 0) return '品目名を入力してください';
    if (kcal === null || kcal > MEAL_KCAL_MAX)
      return 'kcal を整数で入力してください';
    return null;
  });
  const itemsTotal = rows.reduce(
    (sum, row) => sum + (parseWholeNumber(row.kcal) ?? 0),
    0,
  );
  const manualKcal = parseWholeNumber(kcalText);
  const calories = mode === 'photo' ? itemsTotal : manualKcal;
  const kcalError =
    mode === 'manual'
      ? manualKcal === null || manualKcal > MEAL_KCAL_MAX
        ? `0〜${MEAL_KCAL_MAX} の整数で入力してください`
        : null
      : rows.length === 0
        ? '品目を1つ以上追加してください'
        : itemsTotal > MEAL_KCAL_MAX
          ? `合計は ${MEAL_KCAL_MAX} kcal 以内にしてください`
          : null;
  const dateError = editableDates.includes(date)
    ? null
    : 'この日は確定済みのため記録できません';
  const valid =
    !nameError &&
    !noteError &&
    !kcalError &&
    !dateError &&
    (mode === 'manual' || rowErrors.every((error) => error === null));

  async function save() {
    setShowErrors(true);
    if (!valid || calories === null) return;
    const input: MealInput = {
      date,
      mealType,
      name: trimmedName,
      calories,
      source: mode,
      items:
        mode === 'photo'
          ? rows.map((row) => ({
              name: row.name.trim(),
              calories: parseWholeNumber(row.kcal) ?? 0,
            }))
          : [],
      note: note.trim(),
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = meal
        ? await api.updateMeal(meal.id, input)
        : await api.createMeal(input);
      onSaved(saved);
    } catch (caught) {
      setSaveError(describeError(caught));
      onApiError(caught);
    } finally {
      setSaving(false);
    }
  }

  const showForm = mode === 'manual' || rows.length > 0 || estimate !== null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {meal ? '食事を編集' : '食事を記録'}
          </Text>
          <Button
            title={meal ? 'キャンセル' : '閉じる'}
            variant="ghost"
            compact
            onPress={onCancel}
          />
        </View>
        <Segmented
          label="記録方法"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'photo', label: '写真で推定' },
            { value: 'manual', label: '手入力' },
          ]}
        />

        {mode === 'photo' ? (
          <Card>
            <SectionTitle>写真からカロリーを推定</SectionTitle>
            {!photo && !estimating ? (
              <Text style={styles.help}>
                料理全体が写るように撮影すると、AI
                が品目ごとのカロリーを推定します。推定結果はあとから修正できます。
              </Text>
            ) : null}
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.preview}
                resizeMode="cover"
                accessibilityLabel="選択した料理の写真"
              />
            ) : null}
            {estimating ? (
              <Loading label="カロリーを推定しています…" />
            ) : (
              <View style={styles.pickRow}>
                <Button
                  title="カメラで撮影"
                  onPress={() => void pickImage('camera')}
                  style={styles.pickButton}
                  variant={photo ? 'secondary' : 'primary'}
                />
                <Button
                  title="ライブラリから選択"
                  onPress={() => void pickImage('library')}
                  style={styles.pickButton}
                  variant="secondary"
                />
              </View>
            )}
            {photoError ? (
              <Notice
                message={photoError}
                onRetry={
                  photo && !estimating
                    ? () => void runEstimate(photo)
                    : undefined
                }
                retryLabel="もう一度推定"
              />
            ) : null}
            {photoError ? (
              <Button
                title="手入力で記録する"
                variant="ghost"
                compact
                onPress={() => setMode('manual')}
              />
            ) : null}
            {estimate ? (
              <View style={styles.estimateInfo}>
                {estimate.provider === 'mock' ? (
                  <Badge label="サンプル推定: APIキー未設定" tone="accent" />
                ) : null}
                <Text style={styles.estimateMeta}>
                  推定の確からしさ: {confidenceLabels[estimate.confidence]}
                </Text>
                {estimate.notes ? (
                  <Text style={styles.help}>{estimate.notes}</Text>
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        {showForm ? (
          <Card>
            <Field
              label="料理名"
              value={name}
              onChangeText={setName}
              placeholder="例: 鶏の照り焼き定食"
              maxLength={80}
              error={showErrors ? nameError : null}
            />
            {mode === 'photo' ? (
              <View style={styles.items}>
                <Text style={styles.fieldLabel}>品目とカロリー</Text>
                {rows.map((row, index) => (
                  <View key={row.key} style={styles.itemBlock}>
                    <View style={styles.itemRow}>
                      <TextInput
                        accessibilityLabel={`品目${index + 1}の名前`}
                        value={row.name}
                        onChangeText={(text) =>
                          updateRow(row.key, { name: text })
                        }
                        placeholder="品目名"
                        placeholderTextColor="#9aaba5"
                        maxLength={80}
                        style={[styles.input, styles.itemName]}
                      />
                      <TextInput
                        accessibilityLabel={`品目${index + 1}のカロリー`}
                        value={row.kcal}
                        onChangeText={(text) =>
                          updateRow(row.key, { kcal: text })
                        }
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#9aaba5"
                        style={[styles.input, styles.itemKcal]}
                      />
                      <Text style={styles.unit}>kcal</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`品目${index + 1}を削除`}
                        onPress={() =>
                          setRows((current) =>
                            current.filter((item) => item.key !== row.key),
                          )
                        }
                        style={styles.removeButton}
                        hitSlop={8}
                      >
                        <Text style={styles.removeText}>×</Text>
                      </Pressable>
                    </View>
                    {showErrors && rowErrors[index] ? (
                      <Text style={styles.errorText}>{rowErrors[index]}</Text>
                    ) : null}
                  </View>
                ))}
                {rows.length < MAX_ITEMS ? (
                  <Button
                    title="＋ 品目を追加"
                    variant="ghost"
                    compact
                    onPress={() =>
                      setRows((current) => [
                        ...current,
                        { key: nextKey.current++, name: '', kcal: '' },
                      ])
                    }
                    style={styles.addItem}
                  />
                ) : null}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>合計</Text>
                  <Text style={styles.totalValue}>
                    {formatKcal(itemsTotal)}
                  </Text>
                </View>
                {showErrors && kcalError ? (
                  <Text style={styles.errorText}>{kcalError}</Text>
                ) : null}
              </View>
            ) : (
              <Field
                label="カロリー"
                value={kcalText}
                onChangeText={setKcalText}
                keyboardType="number-pad"
                placeholder="例: 650"
                suffix="kcal"
                error={showErrors ? kcalError : null}
              />
            )}
            <View style={styles.group}>
              <Text style={styles.fieldLabel}>食事の種類</Text>
              <Segmented
                label="食事の種類"
                value={mealType}
                onChange={setMealType}
                options={mealTypes.map((type) => ({
                  value: type,
                  label: mealTypeLabels[type],
                }))}
              />
            </View>
            <View style={styles.group}>
              <Text style={styles.fieldLabel}>日付</Text>
              <Segmented
                label="日付"
                value={date}
                onChange={setDate}
                options={editableDates.map((value) => ({
                  value,
                  label: formatDateLabel(value, today),
                }))}
              />
              {dateError ? (
                <Text style={styles.errorText}>{dateError}</Text>
              ) : null}
            </View>
            <Field
              label="メモ（任意）"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={200}
              placeholder="例: 外食、ご飯少なめ"
              error={showErrors ? noteError : null}
            />
            {saveError ? (
              <Notice message={saveError} onRetry={() => void save()} />
            ) : null}
            <Button
              title={
                meal
                  ? '変更を保存'
                  : `${calories !== null ? formatKcal(calories) : ''} を記録する`.trim()
              }
              onPress={() => void save()}
              loading={saving}
              disabled={estimating}
            />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 16, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  pickRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pickButton: { flexGrow: 1, flexBasis: 140 },
  estimateInfo: { gap: 6 },
  estimateMeta: { color: colors.text, fontSize: 14, fontWeight: '600' },
  items: { gap: 8 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  itemBlock: { gap: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  itemName: { flex: 1 },
  itemKcal: { width: 72, textAlign: 'right' },
  unit: { color: colors.muted, fontSize: 13 },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  removeText: { color: colors.danger, fontSize: 18, fontWeight: '700' },
  addItem: { alignSelf: 'flex-start' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  totalValue: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  group: { gap: 6 },
  errorText: { color: colors.danger, fontSize: 12 },
});
