import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { StudentList } from "@/src/features/students/components/StudentList";
import { type StudentsStatusFilter } from "@/src/features/students/hooks/useStudents";
import { useOrgStore } from "@/src/store/orgStore";

const STATUS_OPTIONS: StudentsStatusFilter[] = ["all", "Active", "Inactive", "Graduated"];

export default function StudentsListScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StudentsStatusFilter>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchText]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      status,
      pageSize: 20,
    }),
    [debouncedSearch, status],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.kicker}>Teacher Workspace</Text>
            <Text style={styles.title}>Students</Text>
          </View>

          <Pressable
            onPress={() => {
              router.push("/(app)/(teacher)/students/new" as Href);
            }}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>New Student</Text>
          </Pressable>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.searchBlock}>
            <Text style={styles.label}>Search</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search by first or last name"
              style={styles.searchInput}
              value={searchText}
            />
          </View>

          <View style={styles.statusBlock}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusOptionRow}>
              {STATUS_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    setStatus(option);
                  }}
                  style={[styles.statusOption, status === option && styles.statusOptionActive]}
                >
                  <Text
                    style={[styles.statusOptionText, status === option && styles.statusOptionTextActive]}
                  >
                    {option === "all" ? "All" : option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <StudentList
          filters={filters}
          onSelectStudent={(student) => {
            router.push(`/(app)/(teacher)/students/${student.id}` as Href);
          }}
          orgId={selectedOrgId}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  headerTextWrap: {
    gap: 2,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0d9488",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  createButton: {
    backgroundColor: "#1d4ed8",
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  filterCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  searchBlock: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  statusBlock: {
    gap: 6,
  },
  statusOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusOptionActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  statusOptionText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  statusOptionTextActive: {
    color: "#1e3a8a",
  },
});
