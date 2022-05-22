FROM golang:1.18-alpine
RUN apk add --no-cache git
ENV GO111MODULE=on

WORKDIR /app/src/
ENV GOPATH=/app
COPY src/go.mod .
COPY src/go.sum .
RUN go mod download

ADD src/ ./

RUN go build -o websockets marktai.com/websockets
CMD ["/app/src/websockets"]
