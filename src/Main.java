import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * Pennywise Expense Tracker — Java HTTP Backend
 * Standard JDK 11+ with zero external dependencies.
 *
 * Provides REST API on port 8080:
 * - GET    /api/expenses       -> List all expenses
 * - POST   /api/expenses       -> Add or update an expense (or bulk array)
 * - DELETE /api/expenses?id=X  -> Delete expense by ID
 * - GET    /api/budget         -> Get current monthly budget
 * - POST   /api/budget         -> Set monthly budget
 *
 * Persists data to 'data.json' in the current working directory.
 */
public class Main {
    private static final int PORT = 8080;
    private static final String DATA_FILE = "data.json";

    private static double budget = 10000.0;
    private static final List<Map<String, Object>> expenses = new ArrayList<>();
    private static final Object lock = new Object();

    public static void main(String[] args) throws IOException {
        loadData();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.setExecutor(Executors.newCachedThreadPool());

        server.createContext("/api/expenses", new ExpensesHandler());
        server.createContext("/api/budget", new BudgetHandler());
        server.createContext("/", new RootHandler());

        server.start();
        System.out.println("=================================================");
        System.out.println("  Pennywise Backend Server Running");
        System.out.println("  Listening on: http://localhost:" + PORT);
        System.out.println("  Storage file: " + new File(DATA_FILE).getAbsolutePath());
        System.out.println("=================================================");
    }

    // =========================================================================
    // HTTP Handlers
    // =========================================================================

    static class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            String response = "{\"status\":\"ok\",\"service\":\"Pennywise Expense Tracker API\",\"version\":\"1.0\"}";
            sendJsonResponse(exchange, 200, response);
        }
    }

    static class ExpensesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            String method = exchange.getRequestMethod().toUpperCase();

            if ("OPTIONS".equals(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            try {
                if ("GET".equals(method)) {
                    synchronized (lock) {
                        String json = JsonUtil.toJson(expenses);
                        sendJsonResponse(exchange, 200, json);
                    }
                } else if ("POST".equals(method)) {
                    String body = readBody(exchange);
                    Object parsed = JsonUtil.parse(body);

                    synchronized (lock) {
                        if (parsed instanceof List) {
                            @SuppressWarnings("unchecked")
                            List<Object> list = (List<Object>) parsed;
                            expenses.clear();
                            for (Object item : list) {
                                if (item instanceof Map) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> map = (Map<String, Object>) item;
                                    expenses.add(map);
                                }
                            }
                        } else if (parsed instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> newExpense = (Map<String, Object>) parsed;
                            String id = String.valueOf(newExpense.get("id"));
                            int existingIndex = -1;
                            for (int i = 0; i < expenses.size(); i++) {
                                if (id.equals(String.valueOf(expenses.get(i).get("id")))) {
                                    existingIndex = i;
                                    break;
                                }
                            }
                            if (existingIndex >= 0) {
                                expenses.set(existingIndex, newExpense);
                            } else {
                                expenses.add(newExpense);
                            }
                        }
                        saveData();
                    }
                    sendJsonResponse(exchange, 200, "{\"success\":true}");
                } else if ("DELETE".equals(method)) {
                    Map<String, String> queryParams = parseQueryParams(exchange.getRequestURI().getRawQuery());
                    String id = queryParams.get("id");

                    // If not in query param, check path e.g. /api/expenses/{id}
                    if (id == null || id.isEmpty()) {
                        String path = exchange.getRequestURI().getPath();
                        String prefix = "/api/expenses/";
                        if (path.startsWith(prefix) && path.length() > prefix.length()) {
                            id = path.substring(prefix.length());
                        }
                    }

                    if (id != null && !id.isEmpty()) {
                        final String targetId = id;
                        synchronized (lock) {
                            expenses.removeIf(e -> targetId.equals(String.valueOf(e.get("id"))));
                            saveData();
                        }
                        sendJsonResponse(exchange, 200, "{\"success\":true,\"deleted\":\"" + id + "\"}");
                    } else {
                        sendJsonResponse(exchange, 400, "{\"error\":\"Missing expense ID\"}");
                    }
                } else {
                    sendJsonResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendJsonResponse(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}");
            }
        }
    }

    static class BudgetHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            String method = exchange.getRequestMethod().toUpperCase();

            if ("OPTIONS".equals(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            try {
                if ("GET".equals(method)) {
                    synchronized (lock) {
                        sendJsonResponse(exchange, 200, "{\"budget\":" + budget + "}");
                    }
                } else if ("POST".equals(method)) {
                    String body = readBody(exchange);
                    Object parsed = JsonUtil.parse(body);
                    if (parsed instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> map = (Map<String, Object>) parsed;
                        Object bVal = map.get("budget");
                        if (bVal instanceof Number) {
                            synchronized (lock) {
                                budget = ((Number) bVal).doubleValue();
                                saveData();
                            }
                        }
                    }
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"budget\":" + budget + "}");
                } else {
                    sendJsonResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendJsonResponse(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}");
            }
        }
    }

    // =========================================================================
    // Data Persistence
    // =========================================================================

    private static void loadData() {
        File file = new File(DATA_FILE);
        if (!file.exists()) {
            System.out.println("No existing " + DATA_FILE + " found. Initializing with empty state.");
            return;
        }

        try {
            String content = new String(Files.readAllBytes(Paths.get(DATA_FILE)), StandardCharsets.UTF_8);
            Object parsed = JsonUtil.parse(content);
            if (parsed instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> root = (Map<String, Object>) parsed;
                Object bVal = root.get("budget");
                if (bVal instanceof Number) {
                    budget = ((Number) bVal).doubleValue();
                }
                Object expVal = root.get("expenses");
                if (expVal instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Object> list = (List<Object>) expVal;
                    expenses.clear();
                    for (Object item : list) {
                        if (item instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> map = (Map<String, Object>) item;
                            expenses.add(map);
                        }
                    }
                }
            }
            System.out.println("Loaded " + expenses.size() + " expenses and budget ₹" + budget + " from " + DATA_FILE);
        } catch (Exception e) {
            System.err.println("Failed to read " + DATA_FILE + ": " + e.getMessage());
        }
    }

    private static void saveData() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("budget", budget);
            root.put("expenses", expenses);
            String json = JsonUtil.toJson(root);
            Files.write(Paths.get(DATA_FILE), json.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            System.err.println("Failed to save " + DATA_FILE + ": " + e.getMessage());
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String jsonResponse) throws IOException {
        byte[] bytes = jsonResponse.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody();
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = is.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            return bos.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static Map<String, String> parseQueryParams(String query) {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.isEmpty()) return params;
        for (String pair : query.split("&")) {
            int idx = pair.indexOf("=");
            try {
                if (idx > 0) {
                    params.put(URLDecoder.decode(pair.substring(0, idx), "UTF-8"),
                               URLDecoder.decode(pair.substring(idx + 1), "UTF-8"));
                } else {
                    params.put(URLDecoder.decode(pair, "UTF-8"), "");
                }
            } catch (Exception ignored) {}
        }
        return params;
    }

    // =========================================================================
    // Lightweight Pure-Java JSON Parser & Serializer
    // Zero third-party dependencies required.
    // =========================================================================

    public static class JsonUtil {

        public static String toJson(Object obj) {
            StringBuilder sb = new StringBuilder();
            serialize(obj, sb);
            return sb.toString();
        }

        private static void serialize(Object obj, StringBuilder sb) {
            if (obj == null) {
                sb.append("null");
            } else if (obj instanceof String) {
                sb.append('"').append(escapeString((String) obj)).append('"');
            } else if (obj instanceof Number || obj instanceof Boolean) {
                sb.append(obj);
            } else if (obj instanceof Map) {
                sb.append("{");
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) obj;
                boolean first = true;
                for (Map.Entry<String, Object> entry : map.entrySet()) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append('"').append(escapeString(entry.getKey())).append("\":");
                    serialize(entry.getValue(), sb);
                }
                sb.append("}");
            } else if (obj instanceof List) {
                sb.append("[");
                @SuppressWarnings("unchecked")
                List<Object> list = (List<Object>) obj;
                boolean first = true;
                for (Object item : list) {
                    if (!first) sb.append(",");
                    first = false;
                    serialize(item, sb);
                }
                sb.append("]");
            } else {
                sb.append('"').append(escapeString(obj.toString())).append('"');
            }
        }

        private static String escapeString(String s) {
            if (s == null) return "";
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                switch (c) {
                    case '"':  sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\b': sb.append("\\b"); break;
                    case '\f': sb.append("\\f"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (c < 32) {
                            sb.append(String.format("\\u%04x", (int) c));
                        } else {
                            sb.append(c);
                        }
                }
            }
            return sb.toString();
        }

        public static Object parse(String json) {
            if (json == null) return null;
            return new Parser(json.trim()).parseValue();
        }

        private static class Parser {
            private final String src;
            private int pos = 0;

            Parser(String src) {
                this.src = src;
            }

            Object parseValue() {
                skipWhitespace();
                if (pos >= src.length()) return null;
                char c = src.charAt(pos);
                if (c == '{') return parseObject();
                if (c == '[') return parseArray();
                if (c == '"') return parseString();
                if (c == 't' || c == 'f') return parseBoolean();
                if (c == 'n') return parseNull();
                if (c == '-' || Character.isDigit(c)) return parseNumber();
                throw new IllegalArgumentException("Unexpected character at " + pos + ": " + c);
            }

            private void skipWhitespace() {
                while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) {
                    pos++;
                }
            }

            private Map<String, Object> parseObject() {
                Map<String, Object> map = new LinkedHashMap<>();
                pos++; // skip '{'
                skipWhitespace();
                if (pos < src.length() && src.charAt(pos) == '}') {
                    pos++;
                    return map;
                }
                while (pos < src.length()) {
                    skipWhitespace();
                    if (src.charAt(pos) != '"') {
                        throw new IllegalArgumentException("Expected string key in object at " + pos);
                    }
                    String key = parseString();
                    skipWhitespace();
                    if (pos >= src.length() || src.charAt(pos) != ':') {
                        throw new IllegalArgumentException("Expected ':' after key at " + pos);
                    }
                    pos++; // skip ':'
                    Object val = parseValue();
                    map.put(key, val);
                    skipWhitespace();
                    if (pos < src.length() && src.charAt(pos) == ',') {
                        pos++;
                    } else if (pos < src.length() && src.charAt(pos) == '}') {
                        pos++;
                        break;
                    } else {
                        throw new IllegalArgumentException("Expected ',' or '}' in object at " + pos);
                    }
                }
                return map;
            }

            private List<Object> parseArray() {
                List<Object> list = new ArrayList<>();
                pos++; // skip '['
                skipWhitespace();
                if (pos < src.length() && src.charAt(pos) == ']') {
                    pos++;
                    return list;
                }
                while (pos < src.length()) {
                    Object val = parseValue();
                    list.add(val);
                    skipWhitespace();
                    if (pos < src.length() && src.charAt(pos) == ',') {
                        pos++;
                    } else if (pos < src.length() && src.charAt(pos) == ']') {
                        pos++;
                        break;
                    } else {
                        throw new IllegalArgumentException("Expected ',' or ']' in array at " + pos);
                    }
                }
                return list;
            }

            private String parseString() {
                pos++; // skip opening quote
                StringBuilder sb = new StringBuilder();
                while (pos < src.length()) {
                    char c = src.charAt(pos++);
                    if (c == '"') {
                        return sb.toString();
                    } else if (c == '\\') {
                        if (pos >= src.length()) break;
                        char esc = src.charAt(pos++);
                        switch (esc) {
                            case '"':  sb.append('"'); break;
                            case '\\': sb.append('\\'); break;
                            case '/':  sb.append('/'); break;
                            case 'b':  sb.append('\b'); break;
                            case 'f':  sb.append('\f'); break;
                            case 'n':  sb.append('\n'); break;
                            case 'r':  sb.append('\r'); break;
                            case 't':  sb.append('\t'); break;
                            case 'u':
                                if (pos + 4 <= src.length()) {
                                    String hex = src.substring(pos, pos + 4);
                                    pos += 4;
                                    sb.append((char) Integer.parseInt(hex, 16));
                                }
                                break;
                            default:
                                sb.append(esc);
                        }
                    } else {
                        sb.append(c);
                    }
                }
                return sb.toString();
            }

            private Boolean parseBoolean() {
                if (src.startsWith("true", pos)) {
                    pos += 4;
                    return true;
                } else if (src.startsWith("false", pos)) {
                    pos += 5;
                    return false;
                }
                throw new IllegalArgumentException("Invalid boolean at " + pos);
            }

            private Object parseNull() {
                if (src.startsWith("null", pos)) {
                    pos += 4;
                    return null;
                }
                throw new IllegalArgumentException("Invalid null literal at " + pos);
            }

            private Number parseNumber() {
                int start = pos;
                if (src.charAt(pos) == '-') pos++;
                while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
                boolean isDouble = false;
                if (pos < src.length() && src.charAt(pos) == '.') {
                    isDouble = true;
                    pos++;
                    while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
                }
                if (pos < src.length() && (src.charAt(pos) == 'e' || src.charAt(pos) == 'E')) {
                    isDouble = true;
                    pos++;
                    if (pos < src.length() && (src.charAt(pos) == '+' || src.charAt(pos) == '-')) pos++;
                    while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
                }
                String numStr = src.substring(start, pos);
                if (isDouble) {
                    return Double.parseDouble(numStr);
                }
                try {
                    return Long.parseLong(numStr);
                } catch (NumberFormatException e) {
                    return Double.parseDouble(numStr);
                }
            }
        }
    }
}
