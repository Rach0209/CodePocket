import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Modal, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { LANGUAGES, Language, runCode, RunResult } from './api/piston';

const STORAGE_KEY = 'codepocket_code_v1';

export default function App() {
  const [selectedLang, setSelectedLang] = useState<Language>(LANGUAGES[1]); // Java 기본
  const [code, setCode] = useState(LANGUAGES[1].template);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
    setRunning(true);
    setOutput(null);
    try {
      const result = await runCode(selectedLang, code);
      setOutput(result);
    } catch (e: any) {
      setOutput({ stdout: '', stderr: e.message ?? '실행 실패', code: -1 });
    } finally {
      setRunning(false);
    }
  };

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
  const hasError = output !== null && (output.code !== 0 || output.stderr.length > 0);

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
        {/* 에디터 */}
        <View style={styles.editorContainer}>
          <View style={styles.editorHeader}>
            <Text style={styles.editorLabel}>{selectedLang.label}</Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>초기화</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.editorScroll} horizontal={false}>
            <View style={styles.editorRow}>
              {/* 줄번호 */}
              <View style={styles.lineNumbers}>
                {code.split('\n').map((_, i) => (
                  <Text key={i} style={styles.lineNumber}>{i + 1}</Text>
                ))}
              </View>
              <TextInput
                ref={inputRef}
                style={styles.codeInput}
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

        {/* 실행 버튼 */}
        <TouchableOpacity
          style={[styles.runButton, running && styles.runButtonDisabled]}
          onPress={handleRun}
          disabled={running}
        >
          {running
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.runButtonText}>▶ 실행</Text>
          }
        </TouchableOpacity>

        {/* 출력 */}
        {output && (
          <View style={[styles.outputContainer, hasError && !success && styles.outputError]}>
            <View style={styles.outputHeader}>
              <Text style={[styles.outputLabel, success ? styles.successText : styles.errorText]}>
                {success ? '✓ 성공' : '✗ 오류'}{output.code !== null ? ` (exit ${output.code})` : ''}
              </Text>
              <TouchableOpacity onPress={handleCopyOutput}>
                <Text style={styles.copyText}>{copied ? '복사됨!' : '복사'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.outputScroll}>
              {output.stdout.length > 0 && (
                <Text style={styles.outputText}>{output.stdout}</Text>
              )}
              {output.stderr.length > 0 && (
                <Text style={styles.stderrText}>{output.stderr}</Text>
              )}
              {output.stdout.length === 0 && output.stderr.length === 0 && (
                <Text style={styles.emptyOutput}>(출력 없음)</Text>
              )}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* 언어 선택 모달 */}
      <Modal visible={langPickerVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setLangPickerVisible(false)}
        />
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

  editorContainer: { flex: 1, margin: 12, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#21262d' },
  editorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161b22', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  editorLabel: { color: '#8b949e', fontSize: 12 },
  resetText: { color: '#8b949e', fontSize: 12 },

  editorScroll: { flex: 1, backgroundColor: '#0d1117' },
  editorRow: { flexDirection: 'row', minHeight: '100%' },
  lineNumbers: {
    paddingTop: 12, paddingHorizontal: 8,
    backgroundColor: '#161b22', borderRightWidth: 1, borderRightColor: '#21262d',
    minWidth: 36, alignItems: 'flex-end',
  },
  lineNumber: { color: '#484f58', fontSize: 13, lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  codeInput: {
    flex: 1, color: '#e6edf3', fontSize: 13, lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 12, textAlignVertical: 'top',
  },

  runButton: {
    marginHorizontal: 12, marginBottom: 8, paddingVertical: 14,
    backgroundColor: '#238636', borderRadius: 10, alignItems: 'center',
  },
  runButtonDisabled: { backgroundColor: '#21262d' },
  runButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  outputContainer: {
    marginHorizontal: 12, marginBottom: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#21262d', backgroundColor: '#161b22',
    maxHeight: 200,
  },
  outputError: { borderColor: '#f85149' },
  outputHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  outputLabel: { fontSize: 12, fontWeight: '600' },
  successText: { color: '#3fb950' },
  errorText: { color: '#f85149' },
  copyText: { color: '#8b949e', fontSize: 12 },
  outputScroll: { padding: 12 },
  outputText: {
    color: '#e6edf3', fontSize: 12, lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stderrText: {
    color: '#f85149', fontSize: 12, lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyOutput: { color: '#484f58', fontSize: 12, fontStyle: 'italic' },

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
