# Importa il2cpp_ghidra.h al programa (lo que en la GUI es "Parse C Source")
import os
from java.io import FileInputStream
from ghidra.app.util.cparser.C import CParser
dtm = currentProgram.getDataTypeManager()
p = CParser(dtm, True, None)
p.parse(FileInputStream(os.environ["CABECERA"]))
print("cabecera: %s" % p.getParseMessages()[:500])
