import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Modal, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform, SafeAreaView, PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { LANGUAGES, Language, runCode, RunResult } from './api/piston';

const STORAGE_KEY = 'codepocket_code_v1';

export default function App() {
  const [selectedLang, setSelectedLang] = useState<Language>(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].template);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(13);

  // stdin
  const [stdin, setStdin] = useState('');
  const [stdinOpen, setStdinOpen] = useState(false);

  const handleRunRef = useRef<() => void>(() => {});

  // 드래그 divider
  const [editorRatio, setEditorRatio] = useState(0.6);
  const editorRatioRef = useRef(0.6);
  const startRatioRef = useRef(0.6);
  const startYRef = useRef(0);
  const containerHeightRef = useRef(0);

  // 모바일: PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRatioRef.current = editorRatioRef.current;
      },
      onPanResponderMove: (_, gs) => {
        if (!containerHeightRef.current) return;
        const delta = gs.dy / containerHeightRef.current;
        const next = Math.max(0.15, Math.min(0.82, startRatioRef.current + delta));
        editorRatioRef.current = next;
        setEditorRatio(next);
      },
    })
  ).current;

  // 웹: pointer capture
  const handlePointerDown = (e: any) => {
    e.target.setPointerCapture(e.pointerId);
    startRatioRef.current = editorRatioRef.current;
    startYRef.current = e.clientY;
  };
  const handlePointerMove = (e: any) => {
    if (!e.buttons || !containerHeightRef.current) return;
    const delta = (e.clientY - startYRef.current) / containerHeightRef.current;
    const next = Math.max(0.15, Math.min(0.82, startRatioRef.current + delta));
    editorRatioRef.current = next;
    setEditorRatio(next);
  };

  // 웹: Tab / Shift+Tab (capture 단계에서 브라우저 포커스 이동 차단)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = document.getElementById('code-editor') as HTMLTextAreaElement | null;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      e.preventDefault();

      const { selectionStart: ss, selectionEnd: se, value } = el;

      if (ss === se) {
        // 선택 없음
        if (!e.shiftKey) {
          document.execCommand('insertText', false, '    ');
        } else {
          // Shift+Tab: 현재 줄 앞 공백 최대 4칸 제거
          const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
          const spaces = Math.min(4, value.slice(lineStart).match(/^ */)?.[0].length ?? 0);
          if (spaces > 0) {
            el.selectionStart = lineStart;
            el.selectionEnd = lineStart + spaces;
            document.execCommand('insertText', false, '');
            const cur = Math.max(lineStart, ss - spaces);
            el.selectionStart = cur;
            el.selectionEnd = cur;
          }
        }
        return;
      }

      // 선택 있음: 선택 범위 모든 줄 일괄 처리
      const firstLineStart = value.lastIndexOf('\n', ss - 1) + 1;
      const block = value.slice(firstLineStart, se);
      const lines = block.split('\n');

      if (!e.shiftKey) {
        // Tab: 각 줄 앞에 4칸 추가
        const newBlock = lines.map(l => '    ' + l).join('\n');
        el.selectionStart = firstLineStart;
        el.selectionEnd = se;
        document.execCommand('insertText', false, newBlock);
        el.selectionStart = ss + 4;
        el.selectionEnd = se + lines.length * 4;
      } else {
        // Shift+Tab: 각 줄 앞 공백 최대 4칸 제거
        const newLines = lines.map(l => l.replace(/^ {1,4}/, ''));
        const newBlock = newLines.join('\n');
        const removed = block.length - newBlock.length;
        const removedFirst = lines[0].length - newLines[0].length;
        el.selectionStart = firstLineStart;
        el.selectionEnd = se;
        document.execCommand('insertText', false, newBlock);
        el.selectionStart = Math.max(firstLineStart, ss - removedFirst);
        el.selectionEnd = Math.max(firstLineStart, se - removed);
      }
    };

    el.addEventListener('keydown', handler, true);
    return () => el.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    loadCode(selectedLang.id);
  }, []);

  const loadCode = async (langId: string) => {
    const saved = await AsyncStorage.getItem(`${STORAGE_KEY}_${langId}`);
    if (saved) setCode(saved);
  };

  const saveCode = useCallback(async (langId: string, text: string) => {
    await AsyncStorage.setItem(`${STORAGE_KEY}_${langId}`, text);
  }, []);

  const handleLangChange = async (lang: Language) => {
    await saveCode(selectedLang.id, code);
    setSelectedLang(lang);
    setOutput(null);
    setLangPickerVisible(false);
    const saved = await AsyncStorage.getItem(`${STORAGE_KEY}_${lang.id}`);
    setCode(saved ?? lang.template);
  };

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setOutput(null);
    try {
      const result = await runCode(selectedLang, code, stdin);
      setOutput(result);
    } catch (e: any) {
      setOutput({ stdout: '', stderr: e.message ?? '실행 실패', code: -1 });
    } finally {
      setRunning(false);
    }
  };
  handleRunRef.current = handleRun;


  const handleCodeChange = (text: string) => {
    setCode(text);
    saveCode(selectedLang.id, text);
  };

  const handleCopyOutput = async () => {
    const text = output ? (output.stdout || output.stderr) : '';
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReset = () => {
    setCode(selectedLang.template);
    saveCode(selectedLang.id, selectedLang.template);
    setOutput(null);
  };

  const success = output !== null && output.code === 0;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CodePocket</Text>
        <TouchableOpacity style={styles.langButton} onPress={() => setLangPickerVisible(true)}>
          <Text style={styles.langButtonText}>{selectedLang.label} ▾</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 리사이즈 컨테이너 */}
        <View
          style={{ flex: 1 }}
          onLayout={e => { containerHeightRef.current = e.nativeEvent.layout.height; }}
        >
          {/* 코드 에디터 */}
          <View style={[styles.editorContainer, { flex: editorRatio }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelLabel}>{selectedLang.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.fontSizeControls}>
                  <TouchableOpacity onPress={() => setFontSize(s => Math.max(10, s - 1))} style={styles.fontSizeBtn}>
                    <Text style={styles.fontSizeBtnText}>A-</Text>
                  </TouchableOpacity>
                  <Text style={styles.fontSizeValue}>{fontSize}</Text>
                  <TouchableOpacity onPress={() => setFontSize(s => Math.min(22, s + 1))} style={styles.fontSizeBtn}>
                    <Text style={styles.fontSizeBtnText}>A+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleReset}>
                  <Text style={styles.actionText}>초기화</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.editorScroll}>
              <View style={styles.editorRow}>
                <View style={styles.lineNumbers}>
                  {code.split('\n').map((_, i) => (
                    <Text key={i} style={[styles.lineNumber, { fontSize, lineHeight: fontSize * 1.7 }]}>{i + 1}</Text>
                  ))}
                </View>
                <TextInput
                  nativeID="code-editor"
                  style={[styles.codeInput, { fontSize, lineHeight: fontSize * 1.7 }]}
                  value={code}
                  onChangeText={handleCodeChange}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  scrollEnabled={false}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
          </View>

          {/* 드래그 divider */}
          <View
            style={styles.divider}
            {...panResponder.panHandlers}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
          >
            <View style={styles.dividerHandle} />
          </View>

          {/* 콘솔 출력 */}
          <View style={[styles.consoleContainer, { flex: 1 - editorRatio }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelLabel, output && (success ? styles.successText : styles.errorText)]}>
                {output
                  ? (success ? '✓ 성공' : `✗ 오류 (exit ${output.code})`)
                  : '콘솔'}
              </Text>
              {output && (
                <TouchableOpacity onPress={handleCopyOutput}>
                  <Text style={styles.actionText}>{copied ? '복사됨!' : '복사'}</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.consoleScroll} contentContainerStyle={{ padding: 12 }}>
              {!output && !running && (
                <Text style={styles.placeholderText}>실행 결과가 여기에 표시됩니다.</Text>
              )}
              {running && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#58a6ff" size="small" />
                  <Text style={styles.placeholderText}>실행 중...</Text>
                </View>
              )}
              {output?.stdout ? <Text style={styles.outputText}>{output.stdout}</Text> : null}
              {output?.stderr ? <Text style={styles.stderrText}>{output.stderr}</Text> : null}
              {output && !output.stdout && !output.stderr && (
                <Text style={styles.placeholderText}>(출력 없음)</Text>
              )}
            </ScrollView>
          </View>
        </View>

        {/* stdin 입력 */}
        <View style={styles.stdinWrapper}>
          <TouchableOpacity style={styles.stdinToggle} onPress={() => setStdinOpen(o => !o)}>
            <Text style={styles.stdinToggleText}>
              stdin {stdinOpen ? '▲' : '▼'}{stdin.trim() ? '  ●' : ''}
            </Text>
          </TouchableOpacity>
          {stdinOpen && (
            <TextInput
              style={styles.stdinInput}
              value={stdin}
              onChangeText={setStdin}
              placeholder="입력값을 여기에 작성하세요 (Scanner, input() 등)"
              placeholderTextColor="#484f58"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
          )}
        </View>

        {/* 실행 버튼 */}
        <TouchableOpacity
          style={[styles.runButton, running && styles.runButtonDisabled]}
          onPress={handleRun}
          disabled={running}
        >
          <Text style={styles.runButtonText}>▶ 실행</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* 언어 선택 모달 */}
      <Modal visible={langPickerVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLangPickerVisible(false)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>언어 선택</Text>
          <FlatList
            data={LANGUAGES}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.langItem, item.id === selectedLang.id && styles.langItemActive]}
                onPress={() => handleLangChange(item)}
              >
                <Text style={[styles.langItemText, item.id === selectedLang.id && styles.langItemTextActive]}>
                  {item.label}
                </Text>
                {item.id === selectedLang.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  headerTitle: { color: '#e6edf3', fontSize: 18, fontWeight: 'bold' },
  langButton: {
    backgroundColor: '#21262d', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#30363d',
  },
  langButtonText: { color: '#58a6ff', fontSize: 14, fontWeight: '600' },

  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161b22', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  panelLabel: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  actionText: { color: '#8b949e', fontSize: 12 },
  successText: { color: '#3fb950' },
  errorText: { color: '#f85149' },

  editorContainer: { overflow: 'hidden' },
  editorScroll: { flex: 1, backgroundColor: '#0d1117' },
  editorRow: { flexDirection: 'row', minHeight: '100%' },
  lineNumbers: {
    paddingTop: 12, paddingHorizontal: 8,
    backgroundColor: '#161b22', borderRightWidth: 1, borderRightColor: '#21262d',
    minWidth: 36, alignItems: 'flex-end',
  },
  lineNumber: { color: '#484f58', fontSize: 13, lineHeight: 22, fontFamily: MONO },
  codeInput: {
    flex: 1, color: '#e6edf3', fontSize: 13, lineHeight: 22,
    fontFamily: MONO, padding: 12, textAlignVertical: 'top',
  },

  divider: {
    height: 20, backgroundColor: '#161b22',
    justifyContent: 'center', alignItems: 'center',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#30363d',
    cursor: 'row-resize' as any,
  },
  dividerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#484f58',
  },

  consoleContainer: { overflow: 'hidden' },
  consoleScroll: { flex: 1, backgroundColor: '#0d1117' },
  placeholderText: { color: '#484f58', fontSize: 12, fontStyle: 'italic' },
  outputText: { color: '#e6edf3', fontSize: 12, lineHeight: 20, fontFamily: MONO },
  stderrText: { color: '#f85149', fontSize: 12, lineHeight: 20, fontFamily: MONO },

  stdinWrapper: {
    borderTopWidth: 1, borderTopColor: '#21262d', backgroundColor: '#0d1117',
  },
  stdinToggle: {
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#161b22',
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  stdinToggleText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  stdinInput: {
    color: '#e6edf3', fontSize: 12, fontFamily: MONO,
    padding: 12, maxHeight: 100, backgroundColor: '#0d1117',
  },

  runButton: {
    marginHorizontal: 12, marginVertical: 8, paddingVertical: 14,
    backgroundColor: '#238636', borderRadius: 10, alignItems: 'center',
  },
  runButtonDisabled: { backgroundColor: '#21262d' },
  runButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  fontSizeControls: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0d1117', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  fontSizeBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  fontSizeBtnText: { color: '#58a6ff', fontSize: 11, fontWeight: '600' },
  fontSizeValue: { color: '#8b949e', fontSize: 11, minWidth: 16, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#161b22', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#30363d',
  },
  modalTitle: {
    color: '#e6edf3', fontSize: 16, fontWeight: 'bold',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  langItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  langItemActive: { backgroundColor: '#1f2937' },
  langItemText: { color: '#8b949e', fontSize: 15 },
  langItemTextActive: { color: '#58a6ff', fontWeight: '600' },
  checkmark: { color: '#3fb950', fontSize: 16 },
});
